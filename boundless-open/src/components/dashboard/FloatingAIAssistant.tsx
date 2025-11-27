import { useState, useCallback, useRef, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AIHealthAssistant } from "./AIHealthAssistant";

export const FloatingAIAssistant = ({ userId }: { userId: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout>();
  const lastTapTimeRef = useRef(0);

  // Triple tap detection for closing on mobile
  const handleHeaderTap = useCallback(() => {
    if (!isOpen) return;

    const now = Date.now();
    
    // If more than 300ms has passed, reset tap count
    if (now - lastTapTimeRef.current > 300) {
      tapCountRef.current = 1;
    } else {
      tapCountRef.current += 1;
    }
    
    lastTapTimeRef.current = now;

    // If triple tap detected, close the sheet
    if (tapCountRef.current >= 3) {
      setIsOpen(false);
      tapCountRef.current = 0;
      lastTapTimeRef.current = 0;
    }
  }, [isOpen]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  // Use useCallback to prevent unnecessary re-renders
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    tapCountRef.current = 0;
  }, []);

  // Don't render if userId is not provided
  if (!userId) {
    return null;
  }

  return (
    <>
      {/* Fixed Chat Button - Bottom Right */}
      {!isOpen && (
        <div className="fixed bottom-16 right-4 md:bottom-6 md:right-6 z-[9999]">
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(true);
            }}
            type="button"
            className="h-12 w-12 md:h-16 md:w-16 rounded-full shadow-2xl hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] hover:scale-110 transition-all duration-300 bg-gradient-to-br from-primary to-primary-dark hover:from-primary hover:to-primary"
            size="icon"
            aria-label="Open AI Health Assistant"
          >
            <MessageCircle className="h-5 w-5 md:h-7 md:w-7" />
          </Button>
        </div>
      )}

      {/* Sliding Panel */}
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent 
          side="right" 
          className="w-full sm:w-[90vw] sm:max-w-md md:max-w-lg lg:max-w-xl p-0 overflow-hidden flex flex-col select-none"
          onClickCapture={handleHeaderTap}
        >
          <SheetHeader 
            className="p-4 md:p-6 pb-3 md:pb-4 border-b flex-shrink-0 cursor-default"
          >
            <SheetTitle className="flex items-center gap-2 text-base md:text-lg pointer-events-none user-select-none">
              <MessageCircle className="h-5 w-5 md:h-6 md:w-6" />
              AI Health Assistant
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden pointer-events-auto">
            <AIHealthAssistant userId={userId} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
