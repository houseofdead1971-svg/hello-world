-- Create prescriptions table for storing doctor prescriptions with multiple medicines
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medicines JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  qr_code_data TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment_id ON public.prescriptions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON public.prescriptions(doctor_id);

-- Enable RLS (set to disabled if following previous migrations pattern)
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read and insert prescriptions
CREATE POLICY "Allow read prescriptions for patients and doctors" 
  ON public.prescriptions 
  FOR SELECT 
  USING (auth.uid() = patient_id OR auth.uid() = doctor_id);

CREATE POLICY "Allow doctors to insert prescriptions" 
  ON public.prescriptions 
  FOR INSERT 
  WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Allow update by doctor who created prescription" 
  ON public.prescriptions 
  FOR UPDATE 
  USING (auth.uid() = doctor_id)
  WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Allow delete by doctor who created prescription" 
  ON public.prescriptions 
  FOR DELETE 
  USING (auth.uid() = doctor_id);

-- Create update trigger
CREATE TRIGGER update_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
