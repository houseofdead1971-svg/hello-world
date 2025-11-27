-- Create doctor_patients relationship table
CREATE TABLE public.doctor_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(doctor_id, patient_id)
);

-- Enable RLS
ALTER TABLE public.doctor_patients ENABLE ROW LEVEL SECURITY;

-- Doctors can view their assigned patients
CREATE POLICY "Doctors can view their assigned patients"
ON public.doctor_patients FOR SELECT
USING (
  auth.uid() = doctor_id OR 
  auth.uid() = patient_id
);

-- Doctors can assign patients to themselves
CREATE POLICY "Doctors can assign patients"
ON public.doctor_patients FOR INSERT
WITH CHECK (auth.uid() = doctor_id);

-- Doctors can update their patient relationships
CREATE POLICY "Doctors can update patient relationships"
ON public.doctor_patients FOR UPDATE
USING (auth.uid() = doctor_id);

-- Doctors can remove patient relationships
CREATE POLICY "Doctors can remove patient relationships"
ON public.doctor_patients FOR DELETE
USING (auth.uid() = doctor_id);

-- Add trigger for updated_at
CREATE TRIGGER update_doctor_patients_updated_at
BEFORE UPDATE ON public.doctor_patients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add doctor_name field to profiles for initial signup
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_doctor_name TEXT;
