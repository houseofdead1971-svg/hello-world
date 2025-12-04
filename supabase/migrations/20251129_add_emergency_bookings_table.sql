-- Create emergency_bookings table
CREATE TABLE IF NOT EXISTS public.emergency_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  urgency_level TEXT NOT NULL DEFAULT 'high' CHECK (urgency_level IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'completed')),
  doctor_notes TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  scheduled_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_emergency_bookings_patient_id ON public.emergency_bookings(patient_id);
CREATE INDEX IF NOT EXISTS idx_emergency_bookings_doctor_id ON public.emergency_bookings(doctor_id);
CREATE INDEX IF NOT EXISTS idx_emergency_bookings_status ON public.emergency_bookings(status);

-- Enable RLS
ALTER TABLE public.emergency_bookings ENABLE ROW LEVEL SECURITY;

-- Policies for patients
DROP POLICY IF EXISTS "Patients can view own emergency bookings" ON public.emergency_bookings;
CREATE POLICY "Patients can view own emergency bookings"
ON public.emergency_bookings FOR SELECT
USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Patients can create own emergency bookings" ON public.emergency_bookings;
CREATE POLICY "Patients can create own emergency bookings"
ON public.emergency_bookings FOR INSERT
WITH CHECK (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Patients can update own emergency bookings" ON public.emergency_bookings;
CREATE POLICY "Patients can update own emergency bookings"
ON public.emergency_bookings FOR UPDATE
USING (auth.uid() = patient_id);

-- Policies for doctors
DROP POLICY IF EXISTS "Doctors can view emergency bookings for their patients" ON public.emergency_bookings;
CREATE POLICY "Doctors can view emergency bookings for their patients"
ON public.emergency_bookings FOR SELECT
USING (
  auth.uid() = doctor_id OR
  auth.uid() = patient_id
);

DROP POLICY IF EXISTS "Doctors can update emergency bookings" ON public.emergency_bookings;
CREATE POLICY "Doctors can update emergency bookings"
ON public.emergency_bookings FOR UPDATE
USING (auth.uid() = doctor_id);

-- Create trigger function for updated_at
DROP FUNCTION IF EXISTS public.update_emergency_bookings_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION public.update_emergency_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_emergency_bookings_updated_at ON public.emergency_bookings;
CREATE TRIGGER update_emergency_bookings_updated_at
BEFORE UPDATE ON public.emergency_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_emergency_bookings_updated_at();
