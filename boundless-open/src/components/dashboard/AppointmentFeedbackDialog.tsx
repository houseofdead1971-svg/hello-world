import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AppointmentFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  userRole: "patient" | "doctor";
  doctorName?: string;
  patientName?: string;
  existingFeedback?: {
    patient_feedback?: string;
    patient_rating?: number;
    doctor_feedback?: string;
    doctor_rating?: number;
  };
}

export const AppointmentFeedbackDialog = ({
  open,
  onOpenChange,
  appointmentId,
  patientId,
  doctorId,
  userRole,
  doctorName,
  patientName,
  existingFeedback,
}: AppointmentFeedbackDialogProps) => {
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (userRole === "patient" && existingFeedback?.patient_rating) {
        setRating(existingFeedback.patient_rating);
        setFeedback(existingFeedback.patient_feedback || "");
      } else if (userRole === "doctor" && existingFeedback?.doctor_rating) {
        setRating(existingFeedback.doctor_rating);
        setFeedback(existingFeedback.doctor_feedback || "");
      } else {
        setRating(0);
        setFeedback("");
      }
    }
  }, [open, existingFeedback, userRole]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    if (!feedback.trim()) {
      toast.error("Please provide feedback");
      return;
    }

    if (feedback.length > 1000) {
      toast.error("Feedback must be less than 1000 characters");
      return;
    }

    setSubmitting(true);

    try {
      // Check if feedback already exists
      const { data: existingData } = await supabase
        .from("appointment_feedback")
        .select("id")
        .eq("appointment_id", appointmentId)
        .maybeSingle();

      const feedbackData =
        userRole === "patient"
          ? {
              patient_feedback: feedback.trim(),
              patient_rating: rating,
              patient_feedback_at: new Date().toISOString(),
            }
          : {
              doctor_feedback: feedback.trim(),
              doctor_rating: rating,
              doctor_feedback_at: new Date().toISOString(),
            };

      if (existingData) {
        // Update existing feedback
        const { error } = await supabase
          .from("appointment_feedback")
          .update(feedbackData)
          .eq("id", existingData.id);

        if (error) throw error;
      } else {
        // Insert new feedback
        const { error } = await supabase.from("appointment_feedback").insert({
          appointment_id: appointmentId,
          patient_id: patientId,
          doctor_id: doctorId,
          ...feedbackData,
        });

        if (error) throw error;
      }

      toast.success("Feedback submitted successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const isEditing =
    (userRole === "patient" && existingFeedback?.patient_rating) ||
    (userRole === "doctor" && existingFeedback?.doctor_rating);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Feedback" : "Provide Feedback"}
          </DialogTitle>
          <DialogDescription>
            {userRole === "patient"
              ? `Rate your experience with ${doctorName || "the doctor"}`
              : `Rate your experience with ${patientName || "the patient"}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Rating *</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-muted-foreground">
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback * (max 1000 characters)</Label>
            <Textarea
              id="feedback"
              placeholder="Share your experience..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {feedback.length}/1000 characters
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={submitting || rating === 0 || !feedback.trim()}
              className="flex-1"
            >
              {submitting ? "Submitting..." : isEditing ? "Update Feedback" : "Submit Feedback"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
