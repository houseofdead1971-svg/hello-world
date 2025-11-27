import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, MessageSquare, Star } from "lucide-react";
import { toast } from "sonner";
import { AppointmentFeedbackDialog } from "./AppointmentFeedbackDialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Appointment {
  id: string;
  doctor_id: string;
  appointment_date: string;
  status: string;
  reason: string;
  notes?: string;
  doctor_name?: string;
}

interface Feedback {
  id: string;
  patient_feedback?: string;
  patient_rating?: number;
  doctor_feedback?: string;
  doctor_rating?: number;
}

export const PatientAppointmentHistory = ({ patientId }: { patientId: string }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [feedbacks, setFeedbacks] = useState<Record<string, Feedback>>({});
  const [loading, setLoading] = useState(true);
  const [feedbackDialog, setFeedbackDialog] = useState<{
    open: boolean;
    appointmentId: string;
    doctorId: string;
    doctorName: string;
  } | null>(null);

  useEffect(() => {
    if (patientId) {
      fetchAppointmentHistory();
      fetchFeedbacks();
    }
  }, [patientId]);

  // Real-time subscriptions
  useEffect(() => {
    if (!patientId) return;

    let pollingInterval: number | undefined;

    try {
      const appointmentsChannel = supabase
        .channel('patient-appointment-history')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `patient_id=eq.${patientId}`
          },
          () => {
            fetchAppointmentHistory();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Realtime is working, clear polling if active
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = undefined;
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            console.warn('Realtime subscription unavailable for appointment history, falling back to polling');
            // Start polling every 10 seconds
            if (!pollingInterval) {
              pollingInterval = window.setInterval(() => {
                fetchAppointmentHistory();
              }, 10000) as unknown as number;
            }
          }
        });

      const feedbackChannel = supabase
        .channel('patient-feedback-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointment_feedback',
            filter: `patient_id=eq.${patientId}`
          },
          () => {
            fetchFeedbacks();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Realtime is working
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            console.warn('Realtime subscription unavailable for feedback updates, falling back to polling');
            // Start polling every 10 seconds
            if (!pollingInterval) {
              pollingInterval = window.setInterval(() => {
                fetchFeedbacks();
              }, 10000) as unknown as number;
            }
          }
        });

      return () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        try {
          supabase.removeChannel(appointmentsChannel);
          supabase.removeChannel(feedbackChannel);
        } catch (e) {
          // ignore cleanup errors
        }
      };
    } catch (error) {
      console.error('Failed to set up realtime subscriptions, using polling:', error);
      // Start polling as fallback
      pollingInterval = window.setInterval(() => {
        fetchAppointmentHistory();
        fetchFeedbacks();
      }, 10000) as unknown as number;
      return () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
      };
    }
  }, [patientId]);

  const fetchAppointmentHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("patient_id", patientId)
        .in("status", ["completed", "cancelled", "rejected", "approved"])
        .order("appointment_date", { ascending: false });

      if (error) throw error;

      // Fetch doctor names
      if (data && data.length > 0) {
        const doctorIds = [...new Set(data.map(apt => apt.doctor_id))];
        const { data: doctorProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", doctorIds);

        const appointmentsWithDoctors = data.map(apt => ({
          ...apt,
          doctor_name: doctorProfiles?.find(doc => doc.id === apt.doctor_id)?.full_name || "Unknown Doctor"
        }));

        setAppointments(appointmentsWithDoctors);
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
        .eq("patient_id", patientId);

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
    return (
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">Appointment History</h3>
        <p className="text-muted-foreground">Loading...</p>
      </Card>
    );
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
              <h3 className="text-xl font-semibold">Appointment History</h3>
              <p className="text-sm text-muted-foreground">Your past consultations and feedback</p>
            </div>
          </div>
        </div>
        
        {appointments.length === 0 ? (
          <div className="text-center py-12 px-6">
            <Calendar className="h-16 w-16 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No previous appointments</p>
            <p className="text-sm text-muted-foreground mt-1">Your appointment history will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px] p-6">
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <Card
                  key={appointment.id}
                  className="group p-4 border-primary/10 hover:shadow-[var(--shadow-glow)] hover:border-primary/30 transition-all duration-300 bg-gradient-to-br from-card to-card/80"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium group-hover:text-primary transition-colors">{appointment.doctor_name}</p>
                        <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                          <span>{new Date(appointment.appointment_date).toLocaleDateString()}</span>
                          <span>{new Date(appointment.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      {getStatusBadge(appointment.status)}
                    </div>

                    {appointment.reason && (
                      <p className="text-sm bg-muted/30 p-2 rounded-lg"><span className="font-medium">Reason:</span> {appointment.reason}</p>
                    )}
                    {appointment.notes && (
                      <p className="text-sm bg-muted/30 p-2 rounded-lg"><span className="font-medium">Notes:</span> {appointment.notes}</p>
                    )}

                    {canProvideFeedback(appointment) && (
                      <div className="pt-3 border-t border-primary/10 space-y-3">
                        {feedbacks[appointment.id]?.patient_feedback ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">Your Feedback</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3 w-3 ${
                                      i < (feedbacks[appointment.id]?.patient_rating || 0)
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-muted-foreground"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground bg-primary/5 p-3 rounded-lg">
                              {feedbacks[appointment.id]?.patient_feedback}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setFeedbackDialog({
                                  open: true,
                                  appointmentId: appointment.id,
                                  doctorId: appointment.doctor_id,
                                  doctorName: appointment.doctor_name || "Doctor",
                                })
                              }
                              className="border-primary/20 hover:bg-primary/10"
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
                                doctorId: appointment.doctor_id,
                                doctorName: appointment.doctor_name || "Doctor",
                              })
                            }
                            className="bg-gradient-to-r from-primary to-primary-light hover:shadow-md transition-all"
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Provide Feedback
                          </Button>
                        )}

                        {feedbacks[appointment.id]?.doctor_feedback && (
                          <div className="space-y-2 bg-accent/5 p-3 rounded-lg border border-accent/20">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Doctor's Feedback</span>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3 w-3 ${
                                      i < (feedbacks[appointment.id]?.doctor_rating || 0)
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-muted-foreground"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {feedbacks[appointment.id]?.doctor_feedback}
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
          patientId={patientId}
          doctorId={feedbackDialog.doctorId}
          userRole="patient"
          doctorName={feedbackDialog.doctorName}
          existingFeedback={feedbacks[feedbackDialog.appointmentId]}
        />
      )}
    </>
  );
};
