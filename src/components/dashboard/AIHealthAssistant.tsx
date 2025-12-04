import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Send, Sparkles, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

// Extend window interface to include n8n chat
declare global {
  interface Window {
    n8nCreateChat?: (config: any) => any;
  }
}

// Helper function to generate UUID with fallback
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const AIHealthAssistant = ({ userId }: { userId: string }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useN8nChat, setUseN8nChat] = useState(false);
  const n8nContainerRef = useRef<HTMLDivElement>(null);
  const n8nInstanceRef = useRef<any>(null);

  // Use useMemo to ensure conversationId is stable and doesn't cause re-renders
  const conversationId = useMemo(() => {
    if (!userId) return '';
    // Try to get existing conversation ID from localStorage
    const storedId = localStorage.getItem(`chat_conversation_${userId}`);
    if (storedId) return storedId;
    // Generate new ID and store it
    const newId = generateUUID();
    localStorage.setItem(`chat_conversation_${userId}`, newId);
    return newId;
  }, [userId]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  
  // Initialize n8n chat widget
  useEffect(() => {
    if (typeof window !== 'undefined' && window.n8nCreateChat && n8nContainerRef.current) {
      try {
        const createChat = window.n8nCreateChat;
        
        // Create n8n chat instance in container
        n8nInstanceRef.current = createChat({
          webhookUrl: 'http://localhost:5678/webhook/f160b160-2ec1-4cb3-9f5e-6f07ea70f0a9/chat',
          target: n8nContainerRef.current,
          metadata: {
            userId: userId,
            conversationId: conversationId,
          },
          initialMessages: [
            {
              message: 'Hello! 👋 I\'m your AI Health Assistant. How can I help you today?',
              type: 'ai',
            },
          ],
        });

        setUseN8nChat(true);
        console.log("n8n chat initialized successfully");
      } catch (error) {
        console.error("Error initializing n8n chat:", error);
        // Fallback to local chat if n8n fails
        setUseN8nChat(false);
      }
    }
  }, [userId, conversationId]);
  
  // Keep ref in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Memoize loadMessages to prevent unnecessary re-renders
  const loadMessages = useCallback(async () => {
    if (!userId || !conversationId || useN8nChat) return;
    
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", userId)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading messages:", error);
        // Don't show error toast for missing table (might not exist yet)
        if (error.code !== 'PGRST116') {
          toast.error("Failed to load chat history");
        }
        return;
      }

      if (data) {
        setMessages(data as Message[]);
      }
    } catch (error) {
      console.error("Unexpected error loading messages:", error);
    }
  }, [userId, conversationId, useN8nChat]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    // Use setTimeout to prevent flickering during scroll
    const timeoutId = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  const saveMessage = useCallback(async (role: "user" | "assistant", content: string) => {
    if (!userId || !conversationId) return;
    
    try {
      const { error } = await supabase.from("chat_messages").insert({
        user_id: userId,
        conversation_id: conversationId,
        role,
        content,
      });

      if (error) {
        console.error("Error saving message:", error);
        // Don't show error toast for database issues (fail silently for better UX)
      }
    } catch (error) {
      console.error("Unexpected error saving message:", error);
    }
  }, [userId, conversationId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading || useN8nChat) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    // Add user message to UI
    const userMsg: Message = {
      id: generateUUID(),
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    
    // Update messages state
    const updatedMessages = [...messagesRef.current, userMsg];
    setMessages(updatedMessages);
    
    // Save user message
    await saveMessage("user", userMessage);

    try {
      // Call API with updated messages
      const { data, error } = await supabase.functions.invoke("health-chat", {
        body: {
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          conversationId,
          userId,
        },
      });

      if (error) {
        console.error("Function error:", error);
        console.error("Error details:", {
          message: error.message,
          status: error.status,
          context: error.context
        });
        
        // Handle specific error types
        if (error.status === 503 || error.message?.includes("503")) {
          throw new Error("AI service is not configured. Please contact support.");
        }
        if (error.status === 429 || error.message?.includes("429")) {
          throw new Error("Too many requests. Please try again later.");
        }
        if (error.status === 401 || error.status === 403) {
          throw new Error("API authentication failed. Please check configuration.");
        }
        if (error.status === 400) {
          throw new Error("Invalid request format. Please try again.");
        }
        if (error.message?.includes("timeout") || error.message?.includes("504")) {
          throw new Error("AI service is taking too long to respond. Please try again.");
        }
        throw new Error(error.message || "Failed to get AI response");
      }

      if (!data || !data.message) {
        console.error("Invalid response data:", data);
        throw new Error("Invalid response from AI service");
      }

      const assistantMsg: Message = {
        id: generateUUID(),
        role: "assistant",
        content: data.message,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      await saveMessage("assistant", data.message);
    } catch (error: any) {
      console.error("Error sending message:", error);
      const errorMessage = error?.message || error?.error || "Failed to send message. Please try again.";
      toast.error(errorMessage);
      
      // Remove the user message if there was an error
      setMessages((prev) => prev.filter(m => m.id !== userMsg.id));
    } finally {
      setLoading(false);
    }
  }, [input, loading, userId, conversationId, saveMessage, useN8nChat]);

  // Show error message if userId is not provided
  if (!userId) {
    return (
      <div className="flex flex-col h-full p-6 items-center justify-center">
        <p className="text-muted-foreground">User ID is required to use the AI assistant.</p>
      </div>
    );
  }

  // If n8n chat is initialized, show the n8n container
  if (useN8nChat) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div ref={n8nContainerRef} className="flex-1 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">AI Health Assistant</h3>
          <p className="text-sm text-muted-foreground">Ask me anything about your health</p>
        </div>
      </div>

      <ScrollArea className="flex-1 pr-2 md:pr-4 mb-4 scroll-smooth" style={{ height: "calc(100% - 140px)" }}>
        <div className="space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-3 text-primary/50" />
              <p>Start a conversation with your AI health assistant</p>
              <p className="text-sm mt-2">Ask about medications, health tips, or record keeping</p>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-secondary text-secondary-foreground rounded-lg p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="flex gap-2 flex-shrink-0 pb-2 md:pb-0">
        <Input
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          disabled={loading}
          className="flex-1 touch-manipulation"
        />
        <Button 
          onClick={sendMessage} 
          disabled={loading || !input.trim()}
          size="icon"
          className="h-10 w-10 flex-shrink-0 active:scale-90 transform transition-transform touch-manipulation"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
