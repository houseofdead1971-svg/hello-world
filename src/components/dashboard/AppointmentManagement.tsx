import { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { hasAppointmentPassed, formatAppointmentDateIST, getCurrentISTTime } from "@/lib/istTimezone";

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  status: string;
  reason: string;
  notes: string;
  patient_name?: string;
  patient_email?: string;
  isEmergency?: boolean;
  urgency_level?: string;
  contact_number?: string;
}

export const AppointmentManagement = ({ doctorId }: { doctorId: string }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [doctorNotes, setDoctorNotes] = useState("");

  useEffect(() => {
    fetchAppointments();
  }, [doctorId]);

  const fetchAppointments = async () => {
    try {
      // Fetch regular pending appointments
      const { data: appointmentsData, error } = await (supabase as any)
        .from("appointments")
        .select("*")
        .eq("doctor_id", doctorId)
        .eq("status", "pending")
        .order("appointment_date", { ascending: true });

      if (error) throw error;

      // Filter out pending appointments that have already passed (using IST)
      const validPendingAppointments = (appointmentsData as any[])?.filter((apt: any) => {
        return !hasAppointmentPassed(apt.appointment_date);
      }) || [];

      // Fetch emergency bookings (pending only - they have priority)
      const { data: emergencyData } = await (supabase as any)
        .from("emergency_bookings")
        .select("*")
        .eq("doctor_id", doctorId)
        .eq("status", "pending")
        .order("requested_at", { ascending: false });

      let allAppointments: Appointment[] = [];

      // Add emergency bookings first (higher priority)
      if (emergencyData && emergencyData.length > 0) {
        // Filter emergency bookings by scheduled_date (IST)
        const validEmergencyBookings = emergencyData.filter((eb: any) => {
          // Only show if scheduled_date exists and hasn't passed
          if (!eb.scheduled_date) return true; // Show if no scheduled date yet
          return !hasAppointmentPassed(eb.scheduled_date);
        });

        if (validEmergencyBookings.length > 0) {
          const emergencyPatientIds = [...new Set(validEmergencyBookings.map((eb: any) => eb.patient_id))];
          const { data: emergencyProfiles } = await (supabase as any)
            .from("profiles")
            .select("id, full_name, email")
            .in("id", emergencyPatientIds);

          const emergencyAppointments = validEmergencyBookings.map((eb: any) => {
            const profile = emergencyProfiles?.find((p: any) => p.id === eb.patient_id);
            return {
              id: eb.id,
              patient_id: eb.patient_id,
              doctor_id: eb.doctor_id,
              appointment_date: eb.scheduled_date || eb.requested_at,
              status: eb.status,
              reason: eb.reason,
              notes: eb.doctor_notes || "",
              patient_name: profile?.full_name || "Patient",
              patient_email: profile?.email || "N/A",
              isEmergency: true,
              urgency_level: eb.urgency_level,
              contact_number: eb.contact_number,
            };
          });

          allAppointments = [...emergencyAppointments];
        }
      }

      if (validPendingAppointments.length > 0) {
        const patientIds = validPendingAppointments.map((apt: any) => apt.patient_id);
        const { data: profiles, error: profileError } = await (supabase as any)
          .from("profiles")
          .select("id, full_name, email")
          .in("id", patientIds);

        if (profileError) {
          console.error("Error fetching profiles:", profileError);
        }

        const enrichedAppointments = validPendingAppointments.map((apt: any) => {
          const profile = (profiles as any[])?.find((p: any) => p.id === apt.patient_id);
          return {
            ...apt,
            patient_name: profile?.full_name || "Patient",
            patient_email: profile?.email || "N/A",
            isEmergency: false,
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

  const updateAppointmentStatus = async (appointmentId: string, status: string, appointment?: Appointment) => {
    try {
      const targetAppointment = appointment || selectedAppointment;

      // Prevent cancellation if appointment time has passed (using IST)
      // For emergency bookings, only check if scheduled_date exists and has passed
      if (status === "cancelled" && targetAppointment) {
        if (targetAppointment.isEmergency) {
          // For emergency bookings, only check if there's a scheduled_date and it has passed
          const hasScheduledDate = targetAppointment.appointment_date && 
                                   targetAppointment.appointment_date !== targetAppointment.patient_id; // Ensure it's not just patient_id
          
          // Try to get the actual emergency booking to check scheduled_date
          const { data: emergencyData } = await (supabase as any)
            .from("emergency_bookings")
            .select("scheduled_date, requested_at")
            .eq("id", appointmentId)
            .maybeSingle();
          
          const emergencyBooking = emergencyData as any;
          if (emergencyBooking?.scheduled_date && hasAppointmentPassed(emergencyBooking.scheduled_date)) {
            toast.error("Cannot cancel an appointment that has already passed");
            return;
          }
        } else {
          // For regular appointments, check the appointment_date
          if (hasAppointmentPassed(targetAppointment.appointment_date)) {
            toast.error("Cannot cancel an appointment that has already passed");
            return;
          }
        }
      }
      
      // If approved, automatically assign patient to doctor first
      if (status === "approved" && targetAppointment) {
        const { data: existingRelation } = await (supabase as any)
          .from("doctor_patients")
          .select("id")
          .eq("doctor_id", doctorId)
          .eq("patient_id", targetAppointment.patient_id)
          .maybeSingle();

        if (!existingRelation) {
          const { error: assignError } = await (supabase as any)
            .from("doctor_patients")
            .insert({
              doctor_id: doctorId,
              patient_id: targetAppointment.patient_id,
              status: "active",
              notes: `Assigned via approved appointment on ${new Date().toLocaleDateString()}`
            });

          if (assignError) {
            console.error("Error assigning patient:", assignError);
            toast.error("Failed to assign patient. Please try again.");
            return;
          }
        }
      }

      // Determine which table to update (emergency_bookings or appointments)
      const tableName = targetAppointment?.isEmergency ? "emergency_bookings" : "appointments";
      
      // Update appointment status
      const { error } = await (supabase as any)
        .from(tableName)
        .update({
          status,
          doctor_notes: status === "cancelled" ? "" : doctorNotes,
          updated_at: new Date().toISOString()
        })
        .eq("id", appointmentId);

      if (error) throw error;

      const statusMessages = {
        approved: "Appointment approved and patient assigned!",
        rejected: "Appointment rejected",
        completed: "Appointment marked as completed",
        cancelled: "Appointment cancelled"
      };

      toast.success(statusMessages[status as keyof typeof statusMessages] || `Appointment ${status}`);

      // Notify the patient via the Edge function (uses service role key)
      if ((status === 'approved' || status === 'cancelled' || status === 'rejected') && targetAppointment) {
        console.log('=== NOTIFICATION DEBUG START ===');
        console.log('Status:', status);
        console.log('Target Appointment:', targetAppointment);
        console.log('Patient ID:', targetAppointment.patient_id);
        
        try {
          console.log('Invoking create-notification Edge Function...');
          
          const notificationMessages = {
            approved: {
              title: 'Appointment approved',
              message: `Your appointment on ${formatAppointmentDateIST(targetAppointment.appointment_date)} has been approved.`,
            },
            cancelled: {
              title: 'Appointment cancelled',
              message: `Your appointment on ${formatAppointmentDateIST(targetAppointment.appointment_date)} has been cancelled.`,
            },
            rejected: {
              title: 'Appointment rejected',
              message: `Your appointment request for ${formatAppointmentDateIST(targetAppointment.appointment_date)} has been rejected.`,
            },
          };
          
          const notification = notificationMessages[status as keyof typeof notificationMessages];
          
          const notificationBody = {
            user_id: targetAppointment.patient_id,
            title: notification.title,
            message: notification.message,
            type: 'appointment',
            link: `/dashboard`,
          };
          console.log('Notification body:', notificationBody);
          
          const { data, error: fnError } = await supabase.functions.invoke('create-notification', {
            body: notificationBody,
          });
          
          if (fnError) {
            console.error('Edge function error:', fnError);
          } else {
            console.log('✅ Notification function SUCCESS! Response:', data);
          }
        } catch (nfErr) {
          console.error('❌ Exception calling create-notification:', nfErr);
        }
        console.log('=== NOTIFICATION DEBUG END ===');
      }

      setSelectedAppointment(null);
      setDoctorNotes("");
      await fetchAppointments();
    } catch (error) {
      console.error("Error updating appointment:", error);
      toast.error("Failed to update appointment");
    }
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

  const getUrgencyBadge = (urgency: string) => {
    // Map any old urgency levels to valid ones
    let normalizedUrgency = urgency?.toLowerCase() || "high";
    if (normalizedUrgency === "medium" || normalizedUrgency === "low") {
      normalizedUrgency = "high";
    }
    
    const urgencyBadges: { [key: string]: string } = {
      critical: "bg-red-600 text-white",
      high: "bg-orange-500 text-white",
    };
    const className = urgencyBadges[normalizedUrgency] || "bg-orange-500 text-white";
    return (
      <Badge className={`${className} gap-1 uppercase text-xs font-bold`}>
        <AlertTriangle className="h-3 w-3" />
        {normalizedUrgency}
      </Badge>
    );
  };

  if (loading) {
    return <Card className="p-6"><p className="text-muted-foreground">Loading appointments...</p></Card>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Appointment Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No appointments yet</p>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="overflow-x-auto hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((apt) => (
                      <TableRow 
                        key={apt.id}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {apt.isEmergency && <AlertTriangle className="h-4 w-4 text-red-600" />}
                            {apt.patient_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {formatAppointmentDateIST(apt.appointment_date)}
                          </div>
                          {apt.isEmergency && apt.contact_number && (
                            <div className="text-xs text-muted-foreground mt-1">📱 {apt.contact_number}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            {apt.reason || "N/A"}
                            {apt.isEmergency && apt.urgency_level && (
                              <div className="mt-1">{getUrgencyBadge(apt.urgency_level)}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(apt.status)}
                            {apt.isEmergency && <Badge variant="destructive" className="w-fit text-xs">🚨 EMERGENCY</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {apt.status === "pending" ? (
                            <Button
                              size="sm"
                              variant={apt.isEmergency ? "destructive" : "default"}
                              onClick={() => {
                                setSelectedAppointment(apt);
                                setDoctorNotes(apt.notes || "");
                              }}
                            >
                              Review
                            </Button>
                          ) : apt.status === "approved" && !hasAppointmentPassed(apt.appointment_date) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateAppointmentStatus(apt.id, "cancelled", apt)}
                              className="transition-colors border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-transparent"
                            >
                              Cancel
                            </Button>
                          ) : apt.status === "approved" && hasAppointmentPassed(apt.appointment_date) ? (
                            <Badge variant="outline">Time Passed</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {appointments.map((apt) => (
                  <Card 
                    key={apt.id} 
                    className={`p-4 transition-all duration-200 active:scale-[0.98] touch-manipulation border-l-4 ${apt.isEmergency ? "bg-red-50 border-l-red-600" : "border-l-transparent"}`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {apt.isEmergency && <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />}
                            <h4 className="font-semibold text-base">{apt.patient_name}</h4>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            <span className="text-xs">{formatAppointmentDateIST(apt.appointment_date)}</span>
                          </div>
                          {apt.isEmergency && apt.contact_number && (
                            <div className="text-xs text-muted-foreground mt-1">📱 {apt.contact_number}</div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(apt.status)}
                          {apt.isEmergency && <Badge variant="destructive" className="text-xs">🚨 EMERGENCY</Badge>}
                        </div>
                      </div>
                      
                      {apt.reason && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Reason: </span>
                          <span>{apt.reason}</span>
                        </div>
                      )}

                      {apt.isEmergency && apt.urgency_level && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Urgency: </span>
                          {getUrgencyBadge(apt.urgency_level)}
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        {apt.status === "pending" ? (
                          <Button
                            size="sm"
                            variant={apt.isEmergency ? "destructive" : "default"}
                            onClick={() => {
                              setSelectedAppointment(apt);
                              setDoctorNotes(apt.notes || "");
                            }}
                            className="flex-1 active:scale-95 transform transition-transform touch-manipulation"
                          >
                            Review
                          </Button>
                        ) : apt.status === "approved" && !hasAppointmentPassed(apt.appointment_date) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateAppointmentStatus(apt.id, "cancelled", apt)}
                            className="flex-1 transition-all border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-transparent active:scale-95 transform touch-manipulation"
                          >
                            Cancel
                          </Button>
                        ) : apt.status === "approved" && hasAppointmentPassed(apt.appointment_date) ? (
                          <Badge variant="outline">Time Passed</Badge>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selectedAppointment && (
        <Card>
          <CardHeader>
            <CardTitle>Review Appointment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Patient: {selectedAppointment.patient_name}</p>
              <p className="text-sm text-muted-foreground">
                Date: {formatAppointmentDateIST(selectedAppointment.appointment_date)}
              </p>
              <p className="text-sm text-muted-foreground">Reason: {selectedAppointment.reason}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="doctorNotes">Doctor's Notes</Label>
              <Textarea
                id="doctorNotes"
                placeholder="Add notes about this appointment..."
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                onClick={() => updateAppointmentStatus(selectedAppointment.id, "approved")}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                variant="destructive"
                onClick={() => updateAppointmentStatus(selectedAppointment.id, "rejected")}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedAppointment(null)}
                className="transition-colors border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-transparent"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
