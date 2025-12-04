import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, MessageSquare, Star, Pill, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AppointmentFeedbackDialog } from "./AppointmentFeedbackDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { downloadPrescriptionPDF } from "@/lib/generatePrescriptionPDF";

interface Appointment {
  id: string;
  doctor_id: string;
  appointment_date: string;
  status: string;
  reason: string;
  notes?: string;
  doctor_name?: string;
  isEmergencyBooking?: boolean;
  urgency_level?: string;
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
  medicines: Array<{
    id: string;
    medicine_name: string;
    dosage: string;
    frequency: string;
    duration: string;
    notes?: string;
  }>;
  notes?: string;
  file_url?: string;
  file_path?: string;
  doctor_name?: string;
  doctor_license?: string;
  doctor_specialization?: string;
  created_at: string;
}

export const PatientAppointmentHistory = ({ patientId }: { patientId: string }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [feedbacks, setFeedbacks] = useState<Record<string, Feedback>>({});
  const [prescriptions, setPrescriptions] = useState<Record<string, Prescription[]>>({});
  const [loading, setLoading] = useState(true);
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [feedbackDialog, setFeedbackDialog] = useState<{
    open: boolean;
    appointmentId: string;
    doctorId: string;
    doctorName: string;
  } | null>(null);

  useEffect(() => {
    if (patientId) {
      fetchPatientInfo();
      fetchAppointmentHistory();
      fetchFeedbacks();
      fetchPrescriptions();
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

      // Add real-time subscription for emergency bookings
      // @ts-ignore - emergency_bookings table added via migration
      const emergencyBookingsChannel = supabase
        .channel('patient-emergency-bookings-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'emergency_bookings',
            filter: `patient_id=eq.${patientId}`
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

      // Add real-time subscription for prescriptions
      const prescriptionsChannel = supabase
        .channel('patient-prescriptions-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'prescriptions',
            filter: `patient_id=eq.${patientId}`
          },
          () => {
            fetchPrescriptions();
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            console.warn('Realtime subscription unavailable for prescriptions');
          }
        });

      return () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        try {
          supabase.removeChannel(appointmentsChannel);
          supabase.removeChannel(feedbackChannel);
          supabase.removeChannel(emergencyBookingsChannel);
          supabase.removeChannel(prescriptionsChannel);
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
        fetchPrescriptions();
      }, 10000) as unknown as number;
      return () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
      };
    }
  }, [patientId]);

  const fetchPatientInfo = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", patientId)
        .single();

      if (error) throw error;

      if (data) {
        setPatientName(data.full_name || "");
        setPatientEmail(data.email || "");
      }
    } catch (error) {
      console.error("Error fetching patient info:", error);
    }
  };

  const fetchAppointmentHistory = async () => {
    try {
      setLoading(true);
      
      // Fetch regular appointments
      const { data: appointments, error: apptError } = await supabase
        .from("appointments")
        .select("*")
        .eq("patient_id", patientId)
        .in("status", ["completed", "cancelled", "rejected", "approved"])
        .order("appointment_date", { ascending: false });

      if (apptError) throw apptError;

      // Fetch ALL emergency bookings (not just completed) to show history
      // @ts-ignore - emergency_bookings table added via migration
      let emergencyBookings = [];
      const { data: emergencyData, error: emergencyError } = await supabase
        .from("emergency_bookings")
        .select("id, doctor_id, status, urgency_level, reason, responded_at, scheduled_date, doctor_notes, requested_at, created_at")
        .eq("patient_id", patientId)
        .in("status", ["completed", "cancelled", "rejected", "approved"]);

      if (emergencyError) {
        if (emergencyError.code !== 'PGRST116') {
          console.warn("[fetchAppointmentHistory] Error fetching emergency bookings:", emergencyError);
        }
      } else if (emergencyData && emergencyData.length > 0) {
        console.log("[fetchAppointmentHistory] Fetched emergency bookings:", emergencyData.length);
        // Sort in code since order() might have issues
        emergencyBookings = emergencyData.sort((a, b) => {
          const dateA = new Date(a.responded_at || a.scheduled_date || a.requested_at || a.created_at || 0).getTime();
          const dateB = new Date(b.responded_at || b.scheduled_date || b.requested_at || b.created_at || 0).getTime();
          return dateB - dateA;
        });
      }

      // Combine both data sources
      let allAppointments = [...(appointments || [])];

      // Add emergency bookings to history
      if (emergencyBookings && emergencyBookings.length > 0) {
        const emergencyDoctorIds = [...new Set(emergencyBookings.map(eb => eb.doctor_id))];
        const { data: doctorProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", emergencyDoctorIds);

        const emergencyAppointments = emergencyBookings.map(eb => ({
          id: eb.id,
          doctor_id: eb.doctor_id,
          // Use responded_at if available (doctor has responded), otherwise use requested_at, or scheduled_date
          appointment_date: eb.responded_at || eb.scheduled_date || eb.requested_at || new Date().toISOString(),
          status: eb.status === 'rejected' ? 'cancelled' : eb.status, // Normalize status for UI
          reason: eb.reason,
          notes: eb.doctor_notes,
          doctor_name: doctorProfiles?.find(doc => doc.id === eb.doctor_id)?.full_name || "Unknown Doctor",
          isEmergencyBooking: true,
          urgency_level: eb.urgency_level,
        }));

        allAppointments = [...allAppointments, ...emergencyAppointments];
      }

      // Sort by date
      allAppointments.sort((a, b) => 
        new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime()
      );

      // Fetch doctor names for regular appointments (if not already fetched)
      const appointmentsNeedingDoctors = allAppointments.filter(apt => !apt.doctor_name);
      if (appointmentsNeedingDoctors.length > 0) {
        const doctorIds = [...new Set(appointmentsNeedingDoctors.map(apt => apt.doctor_id))];
        const { data: doctorProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", doctorIds);

        allAppointments = allAppointments.map(apt => ({
          ...apt,
          doctor_name: apt.doctor_name || doctorProfiles?.find(doc => doc.id === apt.doctor_id)?.full_name || "Unknown Doctor"
        }));
      }

      console.log("[fetchAppointmentHistory] Loaded appointments:", allAppointments.length, "items");
      console.log("[fetchAppointmentHistory] Appointment IDs:", allAppointments.map(a => ({ id: a.id, isEmergency: a.isEmergencyBooking })));
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

  const fetchPrescriptions = async () => {
    try {
      // Fetch all prescriptions for this patient
      const { data, error } = await supabase
        .from("prescriptions")
        .select(`
          id,
          appointment_id,
          emergency_booking_id,
          doctor_id,
          patient_id,
          medicines,
          notes,
          file_url,
          file_path,
          doctor_name,
          doctor_license,
          doctor_specialization,
          created_at,
          updated_at
        `)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[fetchPrescriptions] Error fetching prescriptions:", error);
        return; // Don't throw, let page show without prescriptions
      }

      if (!data || data.length === 0) {
        console.log("[fetchPrescriptions] No prescriptions found for patient");
        setPrescriptions({});
        return;
      }

      console.log("[fetchPrescriptions] Fetched prescriptions:", data.length);

      // Collect all unique doctor IDs from prescriptions that don't have doctor info
      const prescriptionsNeedingDoctorInfo = data.filter(p => !p.doctor_name || !p.doctor_license);
      const doctorIds = [...new Set(prescriptionsNeedingDoctorInfo.map(p => p.doctor_id).filter(Boolean))];
      
      let doctorProfiles: any[] = [];
      let doctorNames: any[] = [];

      // Only fetch doctor info if we have prescriptions missing it
      if (doctorIds.length > 0) {
        const [{ data: profiles = [], error: profileError }, { data: names = [], error: nameError }] = await Promise.all([
          supabase
            .from("doctor_profiles")
            .select("user_id, specialization, license_number")
            .in("user_id", doctorIds),
          supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", doctorIds)
        ]);

        if (profileError) {
          console.warn("[fetchPrescriptions] Error fetching doctor profiles:", profileError);
        }
        if (nameError) {
          console.warn("[fetchPrescriptions] Error fetching doctor names:", nameError);
        }

        doctorProfiles = profiles || [];
        doctorNames = names || [];
      }

      // For each prescription, attach doctor info if missing
      const prescriptionsWithDoctorInfo = (data || []).map(prescription => {
        // Use stored info if available, otherwise fetch from doctor profiles
        let doctorName = prescription.doctor_name;
        let doctorLicense = prescription.doctor_license;
        let doctorSpecialization = prescription.doctor_specialization;

        if (!doctorName || !doctorLicense) {
          const doctorProfile = doctorProfiles?.find(dp => dp.user_id === prescription.doctor_id);
          const doctorNameRecord = doctorNames?.find(dn => dn.id === prescription.doctor_id);
          
          doctorName = doctorName || doctorNameRecord?.full_name || "Unknown Doctor";
          doctorLicense = doctorLicense || doctorProfile?.license_number || "N/A";
          doctorSpecialization = doctorSpecialization || doctorProfile?.specialization || "General Practice";
        }

        return {
          ...prescription,
          doctor_name: doctorName,
          doctor_license: doctorLicense,
          doctor_specialization: doctorSpecialization
        };
      });

      // Build prescription map using either appointment_id or emergency_booking_id as key
      const prescriptionMap: Record<string, Prescription[]> = {};
      prescriptionsWithDoctorInfo.forEach((prescription) => {
        // Use appointment_id if it exists, otherwise use emergency_booking_id
        const appointmentId = prescription.appointment_id || prescription.emergency_booking_id;
        if (appointmentId) {
          if (!prescriptionMap[appointmentId]) {
            prescriptionMap[appointmentId] = [];
          }
          prescriptionMap[appointmentId].push(prescription as any);
        } else {
          console.warn("[fetchPrescriptions] Prescription has neither appointment_id nor emergency_booking_id:", prescription.id);
        }
      });

      console.log("[fetchPrescriptions] Prescription map keys:", Object.keys(prescriptionMap));
      console.log("[fetchPrescriptions] Total prescriptions mapped:", prescriptionsWithDoctorInfo.length);
      console.log("[fetchPrescriptions] Sample prescriptions:", prescriptionsWithDoctorInfo.slice(0, 2).map(p => ({
        id: p.id,
        appointment_id: p.appointment_id,
        emergency_booking_id: p.emergency_booking_id,
        patient_id: p.patient_id,
        key_used: p.appointment_id || p.emergency_booking_id
      })));
      setPrescriptions(prescriptionMap);
    } catch (error) {
      console.error("[fetchPrescriptions] Unexpected error:", error);
    }
  };

  const downloadPrescription = async (prescription: Prescription) => {
    if (!prescription.file_url) {
      toast.error("No file available for download");
      return;
    }

    try {
      const response = await fetch(prescription.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Use first medicine name or generic name if not available
      const medicineName = prescription.medicines?.[0]?.medicine_name || "Prescription";
      a.download = `Prescription-${medicineName}-${prescription.created_at.split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading prescription:", error);
      toast.error("Failed to download prescription");
    }
  };

  const getDoctorProfile = async (doctorId: string) => {
    try {
      console.log("[getDoctorProfile] Fetching doctor profile for:", doctorId);
      
      const { data, error } = await supabase
        .from("doctor_profiles")
        .select("specialization, license_number")
        .eq("user_id", doctorId)
        .maybeSingle();

      if (error) {
        console.warn("[getDoctorProfile] Error fetching doctor profile:", error);
        return { specialization: "General Practice", license_number: "N/A" };
      }

      if (!data) {
        console.warn("[getDoctorProfile] No doctor profile found for doctor:", doctorId);
        return { specialization: "General Practice", license_number: "N/A" };
      }

      const result = {
        specialization: data.specialization?.trim() || "General Practice",
        license_number: data.license_number?.trim() || "N/A"
      };
      
      console.log("[getDoctorProfile] Doctor profile fetched:", result);
      return result;
    } catch (error) {
      console.error("[getDoctorProfile] Exception getting doctor profile:", error);
      return { specialization: "General Practice", license_number: "N/A" };
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

  const getUrgencyBadge = (urgency?: string) => {
    let normalized = (urgency || "").toLowerCase();
    if (!normalized) normalized = "high";
    if (normalized === "medium" || normalized === "low") normalized = "high";

    const urgencyBadges: { [key: string]: string } = {
      critical: "bg-red-600 text-white",
      high: "bg-orange-500 text-white",
    };
    const className = urgencyBadges[normalized] || "bg-orange-500 text-white";
    return (
      <Badge className={`${className} gap-1 uppercase text-xs font-bold`}>
        <AlertTriangle className="h-3 w-3" />
        {normalized}
      </Badge>
    );
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
                    {/* Header with doctor name and status */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium group-hover:text-primary transition-colors">{appointment.doctor_name}</p>
                          {(appointment.isEmergency || appointment.isEmergencyBooking) && appointment.urgency_level && (
                            <span>{getUrgencyBadge(appointment.urgency_level)}</span>
                          )}
                        </div>
                        <div className="flex flex-col md:flex-row md:gap-4 gap-1 mt-2 text-sm text-muted-foreground">
                          <span>{new Date(appointment.appointment_date).toLocaleDateString()}</span>
                          <span>{new Date(appointment.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <div className="md:text-right">{getStatusBadge(appointment.status)}</div>
                    </div>

                    {appointment.reason && (
                      <p className="text-sm bg-muted/30 p-2 rounded-lg"><span className="font-medium">Reason:</span> {appointment.reason}</p>
                    )}
                    {appointment.notes && (
                      <p className="text-sm bg-muted/30 p-2 rounded-lg"><span className="font-medium">Notes:</span> {appointment.notes}</p>
                    )}

                    {/* Prescriptions Section */}
                    {prescriptions[appointment.id]?.length ? (
                      <div className="space-y-2 bg-primary/5 p-3 rounded-lg border border-primary/10">
                        <div className="flex items-center gap-2">
                          <Pill className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">
                            Prescriptions ({prescriptions[appointment.id].reduce((total, rx) => total + rx.medicines.length, 0)} medicine{prescriptions[appointment.id].reduce((total, rx) => total + rx.medicines.length, 0) !== 1 ? 's' : ''})
                          </span>
                        </div>
                        <div className="space-y-2">
                          {prescriptions[appointment.id].map((rx, rxIdx) => (
                            <div key={rx.id} className="bg-background/50 p-2.5 rounded-lg space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-xs text-muted-foreground mb-1">
                                    Prescription {rxIdx + 1} ({rx.medicines.length} medicine{rx.medicines.length !== 1 ? 's' : ''})
                                  </p>
                                  {rx.medicines.map((med, medIdx) => (
                                    <div key={med.id} className="ml-2 mb-1">
                                      <p className="font-medium text-sm">{medIdx + 1}. {med.medicine_name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {med.dosage} • {med.frequency}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Duration: {med.duration}
                                      </p>
                                      {med.notes && (
                                        <p className="text-xs text-muted-foreground italic">
                                          Note: {med.notes}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={async () => {
                                      try {
                                        // Use doctor info stored in prescription for faster download
                                        const prescriptionData = {
                                          id: rx.id,
                                          doctorName: rx.doctor_name || appointment.doctor_name || "Doctor",
                                          doctorLicense: rx.doctor_license || "N/A",
                                          doctorSpecialization: rx.doctor_specialization || "General Practice",
                                          patientName: patientName,
                                          patientEmail: patientEmail,
                                          appointmentDate: appointment.appointment_date,
                                          medicines: rx.medicines,
                                          generalNotes: rx.notes,
                                          createdAt: rx.created_at,
                                        };
                                        await downloadPrescriptionPDF(prescriptionData);
                                        toast.success("Prescription PDF downloaded");
                                      } catch (error) {
                                        console.error("Error downloading PDF:", error);
                                        toast.error("Failed to download prescription PDF");
                                      }
                                    }}
                                    title="Download prescription as PDF with QR code"
                                    className="h-8 w-8 p-0"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  {rx.file_url && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => downloadPrescription(rx)}
                                      title="Download uploaded prescription file"
                                      className="h-8 w-8 p-0"
                                    >
                                      <Pill className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {rx.notes && (
                                <p className="text-xs text-muted-foreground italic bg-background/30 p-1 rounded">
                                  General Instructions: {rx.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

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
