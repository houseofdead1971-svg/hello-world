import { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
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

interface Appointment {
  id: string;
  doctor_id: string;
  appointment_date: string;
  status: string;
  reason: string;
  notes: string;
  doctor_name?: string;
}

export const PatientAppointments = ({ patientId }: { patientId: string }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
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
      const channel = supabase
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
            // Realtime is working, clear polling if active
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = undefined;
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            console.warn('Realtime subscription unavailable for appointments, falling back to polling');
            // Start polling every 10 seconds
            if (!pollingInterval) {
              pollingInterval = window.setInterval(() => {
                fetchAppointments();
              }, 10000) as unknown as number;
            }
          }
        });

      return () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          // ignore cleanup errors
        }
      };
    } catch (error) {
      console.error('Failed to set up realtime subscription for appointments, using polling:', error);
      // Start polling as fallback
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
      const { data: appointmentsData, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("patient_id", patientId)
        .in("status", ["pending", "approved"])
        .order("appointment_date", { ascending: true });

      if (error) throw error;

      const now = new Date();
      
      // Filter out appointments that have passed
      const upcomingAppointments = appointmentsData?.filter(apt => {
        const aptDate = new Date(apt.appointment_date);
        
        // Drop pending appointments if time has passed
        if (apt.status === "pending" && aptDate < now) {
          return false;
        }
        
        // Drop approved appointments that have passed (they should be in history)
        if (apt.status === "approved" && aptDate < now) {
          return false;
        }
        
        return true;
      }) || [];

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

        setAppointments(enrichedAppointments);
      } else {
        setAppointments([]);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast.error("Failed to load appointments");
      setLoading(false);
    }
  };

  const cancelAppointment = async (appointmentId: string, appointmentDate: string) => {
    // Check if appointment time has passed
    if (new Date(appointmentDate) < new Date()) {
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
              message: `A patient has cancelled their appointment scheduled for ${new Date(appointmentDate).toLocaleString()}.`,
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

  const hasAppointmentPassed = (appointmentDate: string) => {
    return new Date(appointmentDate) < new Date();
  };

  const getStatusBadge = (status: string) => {
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
                    const canCancel = isPending || (isApproved && !hasAppointmentPassed(apt.appointment_date));
                    
                    return (
                      <TableRow key={apt.id}>
                        <TableCell className="font-medium">
                          <div className="max-w-[150px] truncate">{apt.doctor_name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm">{new Date(apt.appointment_date).toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[120px] truncate" title={apt.reason || "N/A"}>
                            {apt.reason || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(apt.status)}</TableCell>
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
                const canCancel = isPending || (isApproved && !hasAppointmentPassed(apt.appointment_date));
                
                return (
                  <Card key={apt.id} className="p-4 border-primary/20">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-base mb-1">{apt.doctor_name}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            <span className="text-xs">{new Date(apt.appointment_date).toLocaleString()}</span>
                          </div>
                        </div>
                        {getStatusBadge(apt.status)}
                      </div>
                      
                      {apt.reason && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Reason: </span>
                          <span>{apt.reason}</span>
                        </div>
                      )}

                      {apt.notes && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Notes: </span>
                          <span>{apt.notes}</span>
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
