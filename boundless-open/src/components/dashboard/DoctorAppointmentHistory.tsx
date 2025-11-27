import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MessageSquare, Star, Calendar } from "lucide-react";
import { toast } from "sonner";
import { AppointmentFeedbackDialog } from "./AppointmentFeedbackDialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Appointment {
  id: string;
  patient_id: string;
  appointment_date: string;
  status: string;
  reason: string;
  notes?: string;
  patient_name?: string;
  patient_email?: string;
}

interface Feedback {
  id: string;
  patient_feedback?: string;
  patient_rating?: number;
  doctor_feedback?: string;
  doctor_rating?: number;
}

export const DoctorAppointmentHistory = ({ doctorId }: { doctorId: string }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [feedbacks, setFeedbacks] = useState<Record<string, Feedback>>({});
  const [loading, setLoading] = useState(true);
  const [feedbackDialog, setFeedbackDialog] = useState<{
    open: boolean;
    appointmentId: string;
    patientId: string;
    patientName: string;
  } | null>(null);

  useEffect(() => {
    if (doctorId) {
      fetchAppointmentHistory();
      fetchFeedbacks();
    }
  }, [doctorId]);

  // Real-time subscriptions
  useEffect(() => {
    if (!doctorId) return;

    try {
      const appointmentsChannel = supabase
        .channel('doctor-appointment-history')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `doctor_id=eq.${doctorId}`
          },
          () => {
            fetchAppointmentHistory();
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            console.warn('Realtime subscription unavailable for appointment history');
          }
        });

      const feedbackChannel = supabase
        .channel('doctor-feedback-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointment_feedback',
            filter: `doctor_id=eq.${doctorId}`
          },
          () => {
            fetchFeedbacks();
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            console.warn('Realtime subscription unavailable for feedback updates');
          }
        });

      return () => {
        supabase.removeChannel(appointmentsChannel);
        supabase.removeChannel(feedbackChannel);
      };
    } catch (error) {
      console.error('Failed to set up realtime subscriptions:', error);
      return () => {}; // No cleanup needed if subscription failed
    }
  }, [doctorId]);

  const fetchAppointmentHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("doctor_id", doctorId)
        .in("status", ["completed", "cancelled", "rejected", "approved"])
        .order("appointment_date", { ascending: false });

      if (error) throw error;

      // Fetch patient names and emails
      if (data && data.length > 0) {
        const patientIds = [...new Set(data.map(apt => apt.patient_id))];
        const { data: patientProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", patientIds);

        const appointmentsWithPatients = data.map(apt => ({
          ...apt,
          patient_name: patientProfiles?.find(p => p.id === apt.patient_id)?.full_name || "Unknown Patient",
          patient_email: patientProfiles?.find(p => p.id === apt.patient_id)?.email || ""
        }));

        setAppointments(appointmentsWithPatients);
      } else {
        setAppointments([]);
      }
    } catch (error) {
      console.error("Error fetching appointment history:", error);
      toast.error("Failed to load appointment history");
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedbacks = async () => {
    try {
      const { data, error } = await supabase
        .from("appointment_feedback")
        .select("*")
        .eq("doctor_id", doctorId);

      if (error) throw error;

      const feedbackMap: Record<string, Feedback> = {};
      data?.forEach((feedback) => {
        feedbackMap[feedback.appointment_id] = feedback;
      });
      setFeedbacks(feedbackMap);
    } catch (error) {
      console.error("Error fetching feedbacks:", error);
    }
  };

  const canProvideFeedback = (appointment: Appointment) => {
    const appointmentDate = new Date(appointment.appointment_date);
    const now = new Date();
    // Allow feedback for completed appointments OR approved appointments that have passed
    return (appointment.status === "completed" || appointment.status === "approved") && appointmentDate < now;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { variant: "default" as const, label: "Completed" },
      approved: { variant: "default" as const, label: "Approved" },
      cancelled: { variant: "destructive" as const, label: "Cancelled" },
      rejected: { variant: "destructive" as const, label: "Rejected" },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { variant: "secondary" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading history...</p>;
  }

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-br from-card to-card/50 border-primary/10 shadow-[var(--shadow-card)]">
        <div className="p-6 border-b border-primary/10 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shadow-md">
              <Calendar className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Appointment History</h3>
              <p className="text-sm text-muted-foreground">Past consultations and feedback</p>
            </div>
          </div>
        </div>
        
        {appointments.length === 0 ? (
          <div className="text-center py-12 px-6">
            <Calendar className="h-16 w-16 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No appointment history</p>
            <p className="text-sm text-muted-foreground mt-1">Your completed appointments will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px] w-full">
            <div className="space-y-3 sm:space-y-4 p-3 sm:p-6">
              {appointments.map((appointment) => (
                <Card key={appointment.id} className="group p-3 sm:p-4 border-primary/10 hover:shadow-[var(--shadow-glow)] hover:border-primary/30 transition-all duration-300 bg-gradient-to-br from-card to-card/80">
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base group-hover:text-primary transition-colors truncate">{appointment.patient_name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{appointment.patient_email}</p>
                        <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 mt-1 sm:mt-2 text-xs sm:text-sm text-muted-foreground">
                          <span>{new Date(appointment.appointment_date).toLocaleDateString()}</span>
                          <span>{new Date(appointment.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {getStatusBadge(appointment.status)}
                      </div>
                    </div>
                    
                    {appointment.reason && (
                      <p className="text-xs sm:text-sm bg-muted/30 p-2 rounded-lg"><span className="font-medium">Reason:</span> {appointment.reason}</p>
                    )}
                    {appointment.notes && (
                      <p className="text-xs sm:text-sm bg-muted/30 p-2 rounded-lg"><span className="font-medium">Notes:</span> {appointment.notes}</p>
                    )}

                    {canProvideFeedback(appointment) && (
                      <div className="pt-2 sm:pt-3 border-t border-primary/10 space-y-2 sm:space-y-3">
                        {feedbacks[appointment.id]?.doctor_feedback ? (
                          <div className="space-y-1 sm:space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                                <span className="text-xs sm:text-sm font-medium">Your Feedback</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${
                                      i < (feedbacks[appointment.id]?.doctor_rating || 0)
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-muted-foreground"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground bg-primary/5 p-2 sm:p-3 rounded-lg">
                              {feedbacks[appointment.id]?.doctor_feedback}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setFeedbackDialog({
                                  open: true,
                                  appointmentId: appointment.id,
                                  patientId: appointment.patient_id,
                                  patientName: appointment.patient_name || "Patient",
                                })
                              }
                              className="border-primary/20 hover:bg-primary/10 h-8 text-xs"
                            >
                              Edit Feedback
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() =>
                              setFeedbackDialog({
                                open: true,
                                appointmentId: appointment.id,
                                patientId: appointment.patient_id,
                                patientName: appointment.patient_name || "Patient",
                              })
                            }
                            className="bg-gradient-to-r from-primary to-primary-light hover:shadow-md transition-all h-8 text-xs w-full sm:w-auto"
                          >
                            <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            Provide Feedback
                          </Button>
                        )}

                        {feedbacks[appointment.id]?.patient_feedback && (
                          <div className="space-y-1 sm:space-y-2 bg-accent/5 p-2 sm:p-3 rounded-lg border border-accent/20">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                              <span className="text-xs sm:text-sm font-medium">Patient's Feedback</span>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${
                                      i < (feedbacks[appointment.id]?.patient_rating || 0)
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-muted-foreground"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              {feedbacks[appointment.id]?.patient_feedback}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>

      {feedbackDialog && (
        <AppointmentFeedbackDialog
          open={feedbackDialog.open}
          onOpenChange={(open) => !open && setFeedbackDialog(null)}
          appointmentId={feedbackDialog.appointmentId}
          patientId={feedbackDialog.patientId}
          doctorId={doctorId}
          userRole="doctor"
          patientName={feedbackDialog.patientName}
          existingFeedback={feedbacks[feedbackDialog.appointmentId]}
        />
      )}
    </>
  );
};
