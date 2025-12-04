import { useState, useEffect } from "react";
import { UserCheck, Calendar, MapPin, Award, Search, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAppointmentDateIST, getTodayIST, isDateTodayIST, filterPastTimeSlots } from "@/lib/istTimezone";

interface Doctor {
  id: string;
  full_name: string;
  avatar_url?: string;
  specialization: string;
  hospital_affiliation?: string;
  years_of_experience?: number;
  consultation_fee?: number;
  available_for_consultation: boolean;
}

export const AvailableDoctors = ({ patientId }: { patientId: string }) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      // Use the secure public_doctors view instead of direct profile access
      const { data: doctors, error } = await supabase
        .from("public_doctors")
        .select("*");

      if (error) throw error;

      setDoctors(doctors || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching doctors:", error);
      toast.error("Failed to load doctors");
      setLoading(false);
    }
  };

  const generateTimeSlots = (selectedDate?: string) => {
    const slots = [];
    for (let hour = 8; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        // Stop at 8:30 PM
        if (hour === 20 && minute > 30) break;
        
        const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const isPM = hour >= 12;
        const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const time12 = `${hour12}:${minute.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
        
        slots.push({ value: time24, label: time12 });
      }
    }

    // Filter out past times for today (using IST)
    if (selectedDate) {
      return filterPastTimeSlots(selectedDate, slots);
    }

    return slots;
  };

  const requestAppointment = async () => {
    if (!selectedDoctor || !appointmentDate || !appointmentTime) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);

    try {
      // Create appointment date in IST
      const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);

      const { error } = await supabase.from("appointments").insert({
        patient_id: patientId,
        doctor_id: selectedDoctor.id,
        appointment_date: appointmentDateTime.toISOString(),
        reason: reason,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Appointment request sent successfully!");

      // Notify the doctor about the new appointment request
      try {
        await supabase.functions.invoke('create-notification', {
          body: {
            user_id: selectedDoctor.id,
            title: 'New appointment request',
            message: `You have a new appointment request for ${formatAppointmentDateIST(appointmentDateTime)}. Reason: ${reason || 'Not specified'}`,
            type: 'appointment',
            link: `/doctor-dashboard`,
          },
        });
        console.log('Doctor notified about new appointment request');
      } catch (notifErr) {
        console.error('Failed to notify doctor about new request:', notifErr);
      }

      setSelectedDoctor(null);
      setAppointmentDate("");
      setAppointmentTime("");
      setReason("");
    } catch (error) {
      console.error("Error requesting appointment:", error);
      toast.error("Failed to request appointment");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDoctors = doctors.filter((doctor) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      doctor.full_name.toLowerCase().includes(query) ||
      doctor.specialization.toLowerCase().includes(query) ||
      doctor.hospital_affiliation?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return <Card className="p-6"><p className="text-muted-foreground">Loading doctors...</p></Card>;
  }

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-br from-card to-card/50 border-primary/10 shadow-[var(--shadow-card)] h-[600px] flex flex-col">
        <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-primary/5 to-transparent flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shadow-md">
              <UserCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-lg font-semibold">Available Doctors</div>
              <p className="text-sm text-muted-foreground font-normal">Find and book consultations</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 flex-1 flex flex-col min-h-0">
          <div className="mb-4 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, specialization, or hospital..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-primary/20 focus:border-primary/50 transition-colors"
              />
            </div>
          </div>

          {filteredDoctors.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {searchQuery ? "No doctors found matching your search" : "No doctors available"}
            </p>
          ) : (
            <ScrollArea className="flex-1 -mr-6 pr-6">
              <div className="grid grid-cols-1 gap-3">
                {filteredDoctors.map((doctor) => (
                  <Card key={doctor.id} className="group hover:shadow-[var(--shadow-glow)] hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-card to-card/80 border-primary/10">
                    <CardContent className="p-3 sm:p-4 md:p-5">
                      <div className="flex flex-col items-center sm:flex-row sm:items-start gap-3 sm:gap-4">
                        <Avatar className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 flex-shrink-0 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                          <AvatarImage src={doctor.avatar_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary font-semibold text-base sm:text-lg md:text-xl">
                            {doctor.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 w-full text-center sm:text-left">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2 mb-2">
                            <h3 className="font-semibold text-base sm:text-lg group-hover:text-primary transition-colors truncate">{doctor.full_name}</h3>
                            <div className="flex items-center gap-1 flex-wrap flex-shrink-0 justify-center sm:justify-start w-full sm:w-auto">
                              <Badge variant="secondary" className="gap-0.5 bg-accent/10 text-accent border-accent/20 flex-shrink-0 text-xs">
                                <Award className="h-3 w-3" />
                                <span className="truncate max-w-[80px] sm:max-w-[100px]">{doctor.specialization}</span>
                              </Badge>
                              {doctor.available_for_consultation && (
                                <Badge variant="default" className="gap-0.5 bg-emerald-600 text-white border-emerald-600 flex-shrink-0 text-xs whitespace-nowrap hover:bg-emerald-700">
                                  <CheckCircle className="h-3 w-3" />
                                  <span className="hidden sm:inline">Available</span>
                                </Badge>
                              )}
                            </div>
                          </div>
                          {doctor.hospital_affiliation && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate text-xs sm:text-xs">{doctor.hospital_affiliation}</span>
                            </div>
                          )}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t border-primary/10">
                            <div className="text-xs space-y-0.5 text-center sm:text-left">
                              {doctor.years_of_experience && (
                                <p className="text-muted-foreground text-xs">
                                  {doctor.years_of_experience} yrs
                                </p>
                              )}
                              {doctor.consultation_fee && (
                                <p className="font-semibold text-primary text-xs">${doctor.consultation_fee}</p>
                              )}
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                              <Button
                                size="sm"
                                onClick={() => setSelectedDoctor(doctor)}
                                className="bg-gradient-to-r from-primary to-primary-light hover:shadow-md transition-all h-9 px-3 text-xs sm:text-sm flex-1 sm:flex-none"
                              >
                                <Calendar className="h-4 w-4 mr-1.5" />
                                <span className="hidden sm:inline">Book</span>
                                <span className="sm:hidden">Book</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedDoctor} onOpenChange={() => setSelectedDoctor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Appointment</DialogTitle>
            <DialogDescription>
              Schedule a consultation with {selectedDoctor?.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appointmentDate">Date *</Label>
              <Input
                id="appointmentDate"
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                min={getTodayIST()}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="appointmentTime">Time * (8:00 AM - 8:30 PM)</Label>
              <Select value={appointmentTime} onValueChange={setAppointmentTime}>
                <SelectTrigger id="appointmentTime">
                  <SelectValue placeholder="Select appointment time" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {generateTimeSlots(appointmentDate).map((slot) => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Visit</Label>
              <Textarea
                id="reason"
                placeholder="Describe your symptoms or reason for consultation..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={requestAppointment}
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? "Sending..." : "Request Appointment"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedDoctor(null)}
                className="transition-colors hover:bg-destructive hover:text-destructive-foreground"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
