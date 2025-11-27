import { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
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
      const { data: appointmentsData, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("doctor_id", doctorId)
        .eq("status", "pending")
        .order("appointment_date", { ascending: true });

      if (error) throw error;

      // Only show pending appointments that haven't expired
      const now = new Date();
      const validPendingAppointments = appointmentsData?.filter(apt => {
        const aptDate = new Date(apt.appointment_date);
        // Keep pending appointments even if time has passed (they still need to be reviewed)
        return apt.status === "pending";
      }) || [];

      if (validPendingAppointments.length > 0) {
        const patientIds = validPendingAppointments.map((apt) => apt.patient_id);
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", patientIds);

        if (profileError) {
          console.error("Error fetching profiles:", profileError);
        }

        const enrichedAppointments = validPendingAppointments.map((apt) => {
          const profile = profiles?.find((p) => p.id === apt.patient_id);
          return {
            ...apt,
            patient_name: profile?.full_name || "Patient",
            patient_email: profile?.email || "N/A",
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

  const updateAppointmentStatus = async (appointmentId: string, status: string, appointment?: Appointment) => {
    try {
      const targetAppointment = appointment || selectedAppointment;

      // Prevent cancellation if appointment time has passed
      if (status === "cancelled" && targetAppointment) {
        if (new Date(targetAppointment.appointment_date) < new Date()) {
          toast.error("Cannot cancel an appointment that has already passed");
          return;
        }
      }
      
      // If approved, automatically assign patient to doctor first
      if (status === "approved" && targetAppointment) {
        const { data: existingRelation } = await supabase
          .from("doctor_patients")
          .select("id")
          .eq("doctor_id", doctorId)
          .eq("patient_id", targetAppointment.patient_id)
          .maybeSingle();

        if (!existingRelation) {
          const { error: assignError } = await supabase
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

      // Update appointment status
      const { error } = await supabase
        .from("appointments")
        .update({
          status,
          notes: status === "cancelled" ? "" : doctorNotes,
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
              message: `Your appointment on ${new Date(targetAppointment.appointment_date).toLocaleString()} has been approved.`,
            },
            cancelled: {
              title: 'Appointment cancelled',
              message: `Your appointment on ${new Date(targetAppointment.appointment_date).toLocaleString()} has been cancelled.`,
            },
            rejected: {
              title: 'Appointment rejected',
              message: `Your appointment request for ${new Date(targetAppointment.appointment_date).toLocaleString()} has been rejected.`,
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
                      <TableRow key={apt.id}>
                        <TableCell className="font-medium">{apt.patient_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {new Date(apt.appointment_date).toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>{apt.reason || "N/A"}</TableCell>
                        <TableCell>{getStatusBadge(apt.status)}</TableCell>
                        <TableCell>
                          {apt.status === "pending" ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  setSelectedAppointment(apt);
                                  setDoctorNotes(apt.notes || "");
                                }}
                              >
                                Review
                              </Button>
                            </div>
                          ) : apt.status === "approved" && new Date(apt.appointment_date) >= new Date() ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateAppointmentStatus(apt.id, "cancelled", apt)}
                              className="transition-colors border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-transparent"
                            >
                              Cancel
                            </Button>
                          ) : apt.status === "approved" && new Date(apt.appointment_date) < new Date() ? (
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
                  <Card key={apt.id} className="p-4 transition-all duration-200 active:scale-[0.98] touch-manipulation">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-base mb-1">{apt.patient_name}</h4>
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

                      <div className="flex gap-2 pt-2">
                        {apt.status === "pending" ? (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              setSelectedAppointment(apt);
                              setDoctorNotes(apt.notes || "");
                            }}
                            className="flex-1 active:scale-95 transform transition-transform touch-manipulation"
                          >
                            Review
                          </Button>
                        ) : apt.status === "approved" && new Date(apt.appointment_date) >= new Date() ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateAppointmentStatus(apt.id, "cancelled", apt)}
                            className="flex-1 transition-all border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-transparent active:scale-95 transform touch-manipulation"
                          >
                            Cancel
                          </Button>
                        ) : apt.status === "approved" && new Date(apt.appointment_date) < new Date() ? (
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
                Date: {new Date(selectedAppointment.appointment_date).toLocaleString()}
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
