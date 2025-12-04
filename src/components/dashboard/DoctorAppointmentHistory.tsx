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
import { MessageSquare, Star, Calendar, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { AppointmentFeedbackDialog } from "./AppointmentFeedbackDialog";
import { PrescriptionUploadDialog } from "./PrescriptionUploadDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { hasAppointmentPassed } from "@/lib/istTimezone";

interface Appointment {
  id: string;
  patient_id: string;
  appointment_date: string;
  status: string;
  reason: string;
  notes?: string;
  patient_name?: string;
  patient_email?: string;
  is_emergency_booking?: boolean;
}

interface Feedback {
  id: string;
  patient_feedback?: string;
  patient_rating?: number;
  doctor_feedback?: string;
  doctor_rating?: number;
}

interface Prescription {
  id: string;
  medicines: any[];
  notes?: string;
  file_url?: string;
  file_path?: string;
  created_at: string;
}

export const DoctorAppointmentHistory = ({ 
  doctorId, 
  doctorName = "",
  doctorLicense = "",
  doctorSpecialization = ""
}: { 
  doctorId: string;
  doctorName?: string;
  doctorLicense?: string;
  doctorSpecialization?: string;
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [feedbacks, setFeedbacks] = useState<Record<string, Feedback>>({});
  const [prescriptions, setPrescriptions] = useState<Record<string, Prescription[]>>({});
  const [loading, setLoading] = useState(true);
  const [feedbackDialog, setFeedbackDialog] = useState<{
    open: boolean;
    appointmentId: string;
    patientId: string;
    patientName: string;
  } | null>(null);
  const [prescriptionDialog, setPrescriptionDialog] = useState<{
    open: boolean;
    appointmentId: string;
    patientId: string;
    patientName: string;
    patientEmail: string;
    appointmentDate: string;
    isEmergencyBooking?: boolean;
  } | null>(null);

  useEffect(() => {
    if (doctorId) {
      fetchAppointmentHistory();
      fetchFeedbacks();
      fetchPrescriptions();
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

      const emergencyBookingsChannel = supabase
        .channel('doctor-emergency-bookings')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'emergency_bookings',
            filter: `doctor_id=eq.${doctorId}`
          },
          () => {
            fetchAppointmentHistory();
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            console.warn('Realtime subscription unavailable for emergency bookings');
          }
        });

      return () => {
        supabase.removeChannel(appointmentsChannel);
        supabase.removeChannel(feedbackChannel);
        supabase.removeChannel(emergencyBookingsChannel);
      };
    } catch (error) {
      console.error('Failed to set up realtime subscriptions:', error);
      return () => {}; // No cleanup needed if subscription failed
    }
  }, [doctorId]);

  const fetchAppointmentHistory = async () => {
    try {
      setLoading(true);
      
      // Fetch regular appointments
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("doctor_id", doctorId)
        .in("status", ["completed", "cancelled", "rejected", "approved"])
        .order("appointment_date", { ascending: false });

      if (error) throw error;

      // Fetch approved emergency bookings
      // @ts-ignore - emergency_bookings table added via migration
      const { data: emergencyBookings, error: emergencyError } = await supabase
        .from("emergency_bookings")
        .select("id, patient_id, status, urgency_level, reason, responded_at, doctor_notes")
        .eq("doctor_id", doctorId)
        .eq("status", "approved")
        .order("responded_at", { ascending: false });

      if (emergencyError) throw emergencyError;

      // Combine both data sources
      let allAppointments: any[] = [...(data || [])];

      // Add approved emergency bookings as appointments
      if (emergencyBookings && emergencyBookings.length > 0) {
        const emergencyPatientIds = [...new Set(emergencyBookings.map(eb => eb.patient_id))];
        const { data: patientProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", emergencyPatientIds);

        const emergencyAppointments = emergencyBookings.map(eb => ({
          id: eb.id,
          patient_id: eb.patient_id,
          doctor_id: doctorId,
          appointment_date: eb.responded_at || new Date().toISOString(),
          status: "approved",
          reason: eb.reason,
          notes: `Emergency - ${eb.urgency_level?.toUpperCase()} | ${eb.reason}`,
          patient_name: patientProfiles?.find(p => p.id === eb.patient_id)?.full_name || "Unknown Patient",
          patient_email: patientProfiles?.find(p => p.id === eb.patient_id)?.email || "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_emergency_booking: true,
        }));

        allAppointments = [...allAppointments, ...emergencyAppointments];
      }

      // Sort by appointment date
      allAppointments.sort((a, b) => 
        new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime()
      );

      // Fetch patient names for regular appointments (if not already fetched)
      const appointmentsNeedingPatients = allAppointments.filter((apt: any) => !apt.patient_name);
      if (appointmentsNeedingPatients.length > 0) {
        const patientIds = [...new Set(appointmentsNeedingPatients.map((apt: any) => apt.patient_id))];
        const { data: patientProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", patientIds);

        allAppointments = allAppointments.map((apt: any) => ({
          ...apt,
          patient_name: apt.patient_name || patientProfiles?.find(p => p.id === apt.patient_id)?.full_name || "Unknown Patient",
          patient_email: apt.patient_email || patientProfiles?.find(p => p.id === apt.patient_id)?.email || ""
        }));
      }

      setAppointments(allAppointments);
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

  const fetchPrescriptions = async () => {
    try {
      const { data, error } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("doctor_id", doctorId);

      if (error) throw error;

      const prescriptionMap: Record<string, Prescription[]> = {};
      data?.forEach((prescription) => {
        if (!prescriptionMap[prescription.appointment_id]) {
          prescriptionMap[prescription.appointment_id] = [];
        }
        prescriptionMap[prescription.appointment_id].push(prescription);
      });
      setPrescriptions(prescriptionMap);
    } catch (error) {
      console.error("Error fetching prescriptions:", error);
    }
  };

  const canProvideFeedback = (appointment: Appointment) => {
    const appointmentDate = new Date(appointment.appointment_date);
    const now = new Date();
    // Allow feedback for completed appointments OR approved appointments that have passed
    return (appointment.status === "completed" || appointment.status === "approved") && appointmentDate < now;
  };

  const getStatusBadge = (status: string, notes?: string) => {
    const isEmergency = notes?.includes("Emergency -");
    const statusConfig = {
      completed: { variant: "default" as const, label: "Completed" },
      approved: { variant: "default" as const, label: isEmergency ? "Emergency - Approved" : "Approved" },
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
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm sm:text-base group-hover:text-primary transition-colors truncate">{appointment.patient_name}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">{appointment.patient_email}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getStatusBadge(appointment.status, appointment.notes)}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="flex gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                          <span>{new Date(appointment.appointment_date).toLocaleDateString()}</span>
                          <span className="hidden sm:inline">{new Date(appointment.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="sm:hidden">{new Date(appointment.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!hasAppointmentPassed(appointment.appointment_date)}
                          onClick={() =>
                            setPrescriptionDialog({
                              open: true,
                              appointmentId: appointment.id,
                              patientId: appointment.patient_id,
                              patientName: appointment.patient_name || "Patient",
                              patientEmail: appointment.patient_email || "",
                              appointmentDate: appointment.appointment_date,
                              isEmergencyBooking: appointment.is_emergency_booking || false,
                            })
                          }
                          className="border-primary/20 hover:bg-primary/10 h-8 text-xs sm:ml-auto"
                          title={hasAppointmentPassed(appointment.appointment_date) ? "Add or manage prescription for this appointment" : "Prescription can only be added after appointment time"}
                        >
                          <PlusCircle className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">
                            {prescriptions[appointment.id] && prescriptions[appointment.id].length > 0
                              ? `Add Prescription (${prescriptions[appointment.id].length})`
                              : "Add Prescription"}
                          </span>
                          <span className="sm:hidden">
                            {prescriptions[appointment.id] && prescriptions[appointment.id].length > 0
                              ? `Prescription (${prescriptions[appointment.id].length})`
                              : "Prescription"}
                          </span>
                        </Button>
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

      {prescriptionDialog && (
        <PrescriptionUploadDialog
          open={prescriptionDialog.open}
          onOpenChange={(open) => {
            if (!open) setPrescriptionDialog(null);
          }}
          appointmentId={prescriptionDialog.appointmentId}
          doctorId={doctorId}
          patientId={prescriptionDialog.patientId}
          patientName={prescriptionDialog.patientName}
          patientEmail={prescriptionDialog.patientEmail}
          doctorName={doctorName}
          doctorLicense={doctorLicense}
          doctorSpecialization={doctorSpecialization}
          appointmentDate={prescriptionDialog.appointmentDate}
          prescriptions={prescriptions[prescriptionDialog.appointmentId] || []}
          onPrescriptionAdded={() => {
            fetchPrescriptions();
          }}
          isEmergencyBooking={prescriptionDialog.isEmergencyBooking}
        />
      )}
    </>
  );
};
