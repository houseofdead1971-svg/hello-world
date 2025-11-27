-- Create appointment feedback table
CREATE TABLE IF NOT EXISTS public.appointment_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  patient_feedback text,
  patient_rating integer CHECK (patient_rating >= 1 AND patient_rating <= 5),
  doctor_feedback text,
  doctor_rating integer CHECK (doctor_rating >= 1 AND doctor_rating <= 5),
  patient_feedback_at timestamp with time zone,
  doctor_feedback_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(appointment_id)
);

-- Enable RLS
ALTER TABLE public.appointment_feedback ENABLE ROW LEVEL SECURITY;

-- Patients can view feedback for their appointments
CREATE POLICY "Patients can view own appointment feedback"
ON public.appointment_feedback
FOR SELECT
TO public
USING (auth.uid() = patient_id);

-- Doctors can view feedback for their appointments
CREATE POLICY "Doctors can view own appointment feedback"
ON public.appointment_feedback
FOR SELECT
TO public
USING (auth.uid() = doctor_id);

-- Patients can insert/update their feedback
CREATE POLICY "Patients can insert feedback"
ON public.appointment_feedback
FOR INSERT
TO public
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can update own feedback"
ON public.appointment_feedback
FOR UPDATE
TO public
USING (auth.uid() = patient_id);

-- Doctors can update their feedback
CREATE POLICY "Doctors can update own feedback"
ON public.appointment_feedback
FOR UPDATE
TO public
USING (auth.uid() = doctor_id);

-- Enable realtime
ALTER TABLE public.appointment_feedback REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE appointment_feedback;

-- Add trigger for updated_at
CREATE TRIGGER update_appointment_feedback_updated_at
  BEFORE UPDATE ON public.appointment_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
