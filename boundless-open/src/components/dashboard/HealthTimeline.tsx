import { useState, useEffect } from "react";
import { Activity, Plus, Trash2, Edit, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimelineEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  category: string;
  created_at: string;
}

export const HealthTimeline = ({ userId }: { userId: string }) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_date: new Date().toISOString().split("T")[0],
    category: "other",
  });

  useEffect(() => {
    loadEvents();
  }, [userId]);

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from("health_timeline")
      .select("*")
      .eq("user_id", userId)
      .order("event_date", { ascending: false });

    if (error) {
      toast.error("Failed to load timeline");
      return;
    }

    setEvents(data || []);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (editingEvent) {
      const { error } = await supabase
        .from("health_timeline")
        .update({
          title: formData.title,
          description: formData.description || null,
          event_date: new Date(formData.event_date).toISOString(),
          category: formData.category,
        })
        .eq("id", editingEvent.id);

      if (error) {
        toast.error("Failed to update event");
        return;
      }
      toast.success("Event updated successfully");
    } else {
      const { error } = await supabase.from("health_timeline").insert({
        user_id: userId,
        title: formData.title,
        description: formData.description || null,
        event_date: new Date(formData.event_date).toISOString(),
        category: formData.category,
      });

      if (error) {
        toast.error("Failed to add event");
        return;
      }
      toast.success("Event added successfully");
    }

    setIsDialogOpen(false);
    setEditingEvent(null);
    setFormData({
      title: "",
      description: "",
      event_date: new Date().toISOString().split("T")[0],
      category: "other",
    });
    loadEvents();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("health_timeline").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete event");
      return;
    }

    toast.success("Event deleted successfully");
    loadEvents();
  };

  const openEditDialog = (event: TimelineEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      event_date: new Date(event.event_date).toISOString().split("T")[0],
      category: event.category,
    });
    setIsDialogOpen(true);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      appointment: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
      lab: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
      medication: "bg-green-500/20 text-green-700 dark:text-green-300",
      symptom: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
      procedure: "bg-red-500/20 text-red-700 dark:text-red-300",
      other: "bg-gray-500/20 text-gray-700 dark:text-gray-300",
    };
    return colors[category] || colors.other;
  };

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-br from-card to-card/50 border-primary/10 shadow-[var(--shadow-card)] h-full flex flex-col">
        <div className="p-4 md:p-6 border-b border-primary/10 bg-gradient-to-r from-accent/5 to-transparent flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-md flex-shrink-0">
                <Activity className="h-5 w-5 text-accent-foreground" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">Health History</h3>
                <p className="text-sm text-muted-foreground hidden sm:block">Complete timeline of health events</p>
              </div>
            </div>
            <Button
              onClick={() => setIsDialogOpen(true)}
              size="sm"
              className="bg-gradient-to-r from-accent to-accent/80 hover:shadow-md transition-all flex-shrink-0 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-12 px-6 text-muted-foreground flex-1 flex flex-col items-center justify-center">
            <Calendar className="h-16 w-16 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-medium">No health events yet</p>
            <p className="text-sm mt-2">Start tracking your health journey</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="group flex gap-3 pb-4 border-b border-primary/10 last:border-0 hover:bg-accent/5 -mx-2 px-2 rounded-lg transition-all">
                  <div className="h-2 w-2 rounded-full bg-gradient-to-br from-primary to-accent mt-2 ring-4 ring-primary/10 group-hover:ring-primary/20 transition-all" />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryColor(event.category)} backdrop-blur-sm`}>
                            {event.category}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(event.event_date), "MMM dd, yyyy")}
                          </p>
                        </div>
                        <p className="font-medium mb-1 group-hover:text-primary transition-colors">{event.title}</p>
                        {event.description && (
                          <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded-lg mt-2">{event.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(event)}
                          className="h-8 w-8 hover:bg-primary/10"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(event.id)}
                          className="h-8 w-8 hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Edit Event" : "Add Health Event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Annual checkup"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="All vitals normal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="appointment">Appointment</SelectItem>
                  <SelectItem value="lab">Lab Results</SelectItem>
                  <SelectItem value="medication">Medication</SelectItem>
                  <SelectItem value="symptom">Symptom</SelectItem>
                  <SelectItem value="procedure">Procedure</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event_date">Date</Label>
              <Input
                id="event_date"
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingEvent ? "Update" : "Add"} Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
