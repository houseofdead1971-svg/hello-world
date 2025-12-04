import { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hasAppointmentPassed, formatAppointmentDateIST, getCurrentISTTime } from "@/lib/istTimezone";

interface Appointment {
  id: string;
  doctor_id: string;
  appointment_date: string;
  status: string;
  reason: string;
  notes: string;
  doctor_name?: string;
}

interface EmergencyBooking {
  id: string;
  doctor_id: string;
  status: string;
  urgency_level: string;
  reason: string;
  doctor_notes?: string;
  requested_at: string;
  responded_at?: string;
  doctor_name?: string;
  isEmergency: true;
}

type AnyAppointment = Appointment | EmergencyBooking;

export const PatientAppointments = ({ patientId }: { patientId: string }) => {
  const [appointments, setAppointments] = useState<AnyAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (patientId) {
      fetchAppointments();
    }
  }, [patientId]);

  // Real-time subscription for appointments
  useEffect(() => {
    if (!patientId) return;

    let pollingInterval: number | undefined;

    try {
      const appointmentsChannel = supabase
        .channel('patient-appointments')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `patient_id=eq.${patientId}`
          },
          () => {
            fetchAppointments();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = undefined;
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            console.warn('Realtime subscription unavailable for appointments, falling back to polling');
            if (!pollingInterval) {
              pollingInterval = window.setInterval(() => {
                fetchAppointments();
              }, 10000) as unknown as number;
            }
          }
        });

      // Subscribe to emergency bookings
      const emergencyChannel = supabase
        .channel('patient-emergency-bookings')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'emergency_bookings',
            filter: `patient_id=eq.${patientId}`
          },
          () => {
            fetchAppointments();
          }
        )
        .subscribe();

      return () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        try {
          supabase.removeChannel(appointmentsChannel);
          supabase.removeChannel(emergencyChannel);
        } catch (e) {
          // ignore cleanup errors
        }
      };
    } catch (error) {
      console.error('Failed to set up realtime subscription, using polling:', error);
      pollingInterval = window.setInterval(() => {
        fetchAppointments();
      }, 10000) as unknown as number;
      return () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
      };
    }
  }, [patientId]);

  const fetchAppointments = async () => {
    try {
      const now = getCurrentISTTime();
      
      // Fetch regular appointments
      const { data: appointmentsData, error: apptError } = await supabase
        .from("appointments")
        .select("*")
        .eq("patient_id", patientId)
        .in("status", ["pending", "approved"])
        .order("appointment_date", { ascending: true });

      if (apptError) throw apptError;

      // Filter out appointments that have passed
      const upcomingAppointments = appointmentsData?.filter(apt => {
        const aptDate = new Date(apt.appointment_date);
        if ((apt.status === "pending" || apt.status === "approved") && aptDate < now) {
          return false;
        }
        return true;
      }) || [];

      // Fetch emergency bookings - Show pending and approved (only pending shown here, approved go to history)
      // @ts-ignore - emergency_bookings table added via migration
      const { data: emergencyData, error: emergencyError } = await supabase
        .from("emergency_bookings")
        .select("*")
        .eq("patient_id", patientId)
        .in("status", ["pending", "approved", "responded"])
        .order("requested_at", { ascending: false });

      if (emergencyError && emergencyError.code !== 'PGRST116') {
        console.warn("Error fetching emergency bookings:", emergencyError);
      }

      // Filter to show only pending emergency bookings (approved ones go to history)
      const pendingEmergencyData = emergencyData?.filter((eb: any) => eb.status === "pending") || [];

      // Filter emergency bookings by time - don't show if already passed
      // Use scheduled_date if available, otherwise use responded_at or requested_at
      const validPendingEmergency = pendingEmergencyData.filter((eb: any) => {
        const dateToCheck = eb.scheduled_date || eb.responded_at || eb.requested_at;
        if (!dateToCheck) return true;
        // Only show if the appointment time hasn't passed (using IST)
        return !hasAppointmentPassed(dateToCheck);
      });

      // Combine all appointments and emergency bookings
      let allAppointments: AnyAppointment[] = [];

      // Add emergency bookings first (higher priority)
      if (validPendingEmergency && validPendingEmergency.length > 0) {
        const emergencyDoctorIds = [...new Set(validPendingEmergency.map((eb: any) => eb.doctor_id))];
        const { data: doctorProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", emergencyDoctorIds);

        const emergencyBookings = validPendingEmergency.map((eb: any) => ({
          id: eb.id,
          doctor_id: eb.doctor_id,
          status: eb.status,
          urgency_level: eb.urgency_level,
          reason: eb.reason,
          doctor_notes: eb.doctor_notes,
          requested_at: eb.requested_at,
          responded_at: eb.responded_at,
          appointment_date: eb.scheduled_date || eb.responded_at || eb.requested_at,
          doctor_name: doctorProfiles?.find((doc: any) => doc.id === eb.doctor_id)?.full_name || "Unknown Doctor",
          isEmergency: true as const,
        }));

        allAppointments = [...emergencyBookings, ...allAppointments];
      }

      // Add regular appointments
      if (upcomingAppointments.length > 0) {
        const doctorIds = [...new Set(upcomingAppointments.map((apt) => apt.doctor_id))];
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", doctorIds);

        if (profileError) {
          console.error("Error fetching doctor profiles:", profileError);
        }

        const enrichedAppointments = upcomingAppointments.map((apt) => {
          const profile = profiles?.find((p) => p.id === apt.doctor_id);
          return {
            ...apt,
            doctor_name: profile?.full_name || "Dr. (Name not available)",
          };
        });

        allAppointments = [...allAppointments, ...enrichedAppointments];
      }

      setAppointments(allAppointments);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast.error("Failed to load appointments");
      setLoading(false);
    }
  };

  const cancelAppointment = async (appointmentId: string, appointmentDate: string) => {
    // Check if appointment time has passed (using IST)
    if (hasAppointmentPassed(appointmentDate)) {
      toast.error("Cannot cancel an appointment that has already passed");
      return;
    }

    try {
      // First get the appointment details to find the doctor
      const { data: appointment, error: fetchError } = await supabase
        .from("appointments")
        .select("*, doctor_id")
        .eq("id", appointmentId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId);

      if (error) throw error;

      toast.success("Appointment cancelled successfully");

      // Notify the doctor about the cancellation
      if (appointment?.doctor_id) {
        try {
          await supabase.functions.invoke('create-notification', {
            body: {
              user_id: appointment.doctor_id,
              title: 'Appointment cancelled by patient',
              message: `A patient has cancelled their appointment scheduled for ${formatAppointmentDateIST(appointmentDate)}.`,
              type: 'appointment',
              link: `/doctor-dashboard`,
            },
          });
          console.log('Doctor notified about patient cancellation');
        } catch (notifErr) {
          console.error('Failed to notify doctor:', notifErr);
        }
      }

      await fetchAppointments();
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast.error("Failed to cancel appointment");
    }
  };

  const getStatusBadge = (status: string, isEmergency?: boolean, urgencyLevel?: string) => {
    if (isEmergency) {
      // Map any old urgency levels to valid ones
      let normalizedUrgency = urgencyLevel?.toLowerCase() || "high";
      if (normalizedUrgency === "medium" || normalizedUrgency === "low") {
        normalizedUrgency = "high";
      }
      
      const urgencyColors = {
        high: "bg-orange-100 text-orange-800",
        critical: "bg-red-100 text-red-800",
      };
      const colorClass = urgencyColors[normalizedUrgency as keyof typeof urgencyColors] || urgencyColors.high;
      return (
        <div className="flex items-center gap-2">
          <Badge variant="default" className="gap-1 bg-red-600">
            <AlertTriangle className="h-3 w-3" />
            Emergency
          </Badge>
          <Badge className={`gap-1 ${colorClass} text-xs`}>
            {normalizedUrgency.toUpperCase()}
          </Badge>
        </div>
      );
    }

    const badges = {
      pending: <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" />Pending</Badge>,
      approved: <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Approved</Badge>,
      rejected: <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>,
      completed: <Badge variant="outline" className="gap-1"><CheckCircle className="h-3 w-3" />Completed</Badge>,
      cancelled: <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Cancelled</Badge>,
    };
    return badges[status as keyof typeof badges] || <Badge>{status}</Badge>;
  };

  if (loading) {
    return <Card className="p-6"><p className="text-muted-foreground">Loading appointments...</p></Card>;
  }

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-card to-card/50 border-primary/10 shadow-[var(--shadow-card)] h-[600px] flex flex-col">
      <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-primary/5 to-transparent flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shadow-md">
            <Calendar className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-lg font-semibold">Upcoming Appointments</div>
            <p className="text-sm text-muted-foreground font-normal">Your scheduled consultations</p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 flex-1 min-h-0 overflow-auto">
        {appointments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No appointments yet</p>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="overflow-x-auto hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((apt) => {
                    const status = apt.status?.toLowerCase()?.trim();
                    const isPending = status === "pending";
                    const isApproved = status === "approved";
                    const isEmergency = 'isEmergency' in apt && apt.isEmergency;
                    const canCancel = isPending || (isApproved && !hasAppointmentPassed(apt.appointment_date));
                    
                    return (
                      <TableRow key={apt.id} className={isEmergency ? "bg-red-50/50 dark:bg-red-950/20" : ""}>
                        <TableCell className="font-medium">
                          <div className="max-w-[150px] truncate">{apt.doctor_name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm">{formatAppointmentDateIST(apt.appointment_date)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[120px] truncate" title={apt.reason || "N/A"}>
                            {apt.reason || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(apt.status, isEmergency, 'urgency_level' in apt ? apt.urgency_level : undefined)}
                        </TableCell>
                        <TableCell>
                          {canCancel ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelAppointment(apt.id, apt.appointment_date)}
                              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                            >
                              Cancel
                            </Button>
                          ) : hasAppointmentPassed(apt.appointment_date) && isApproved ? (
                            <Badge variant="outline">Time Passed</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {appointments.map((apt) => {
                const status = apt.status?.toLowerCase()?.trim();
                const isPending = status === "pending";
                const isApproved = status === "approved";
                const isEmergency = 'isEmergency' in apt && apt.isEmergency;
                const canCancel = isPending || (isApproved && !hasAppointmentPassed(apt.appointment_date));
                
                return (
                  <Card key={apt.id} className={`p-4 border-primary/20 ${isEmergency ? "border-red-400 bg-red-50/50 dark:bg-red-950/20" : ""}`}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-base mb-1">{apt.doctor_name}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            <span className="text-xs">{formatAppointmentDateIST(apt.appointment_date)}</span>
                          </div>
                        </div>
                        {getStatusBadge(apt.status, isEmergency, 'urgency_level' in apt ? apt.urgency_level : undefined)}
                      </div>
                      
                      {apt.reason && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Reason: </span>
                          <span>{apt.reason}</span>
                        </div>
                      )}

                      {('notes' in apt && apt.notes) || ('doctor_notes' in apt && apt.doctor_notes) && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Notes: </span>
                          <span>{'notes' in apt ? apt.notes : ('doctor_notes' in apt ? apt.doctor_notes : '')}</span>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        {canCancel ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelAppointment(apt.id, apt.appointment_date)}
                            className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                          >
                            Cancel
                          </Button>
                        ) : hasAppointmentPassed(apt.appointment_date) && isApproved ? (
                          <Badge variant="outline">Time Passed</Badge>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
