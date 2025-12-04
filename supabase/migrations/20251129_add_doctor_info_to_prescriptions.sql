-- Add doctor information columns to prescriptions table
-- This allows us to store doctor profile info at prescription creation time
-- avoiding the need for a separate lookup when downloading prescriptions

ALTER TABLE public.prescriptions 
ADD COLUMN IF NOT EXISTS doctor_name TEXT,
ADD COLUMN IF NOT EXISTS doctor_license TEXT,
ADD COLUMN IF NOT EXISTS doctor_specialization TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Create index on doctor_id for better performance
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id_created ON public.prescriptions(doctor_id, created_at);

-- Update RLS policy to allow prescriptions to be readable
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Ensure proper policies exist
DROP POLICY IF EXISTS "Allow read prescriptions for patients and doctors" ON public.prescriptions;
DROP POLICY IF EXISTS "Allow doctors to insert prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Allow update by doctor who created prescription" ON public.prescriptions;
DROP POLICY IF EXISTS "Allow delete by doctor who created prescription" ON public.prescriptions;

-- Create comprehensive policies
CREATE POLICY "Patients can read their own prescriptions"
  ON public.prescriptions 
  FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "Doctors can read prescriptions they created"
  ON public.prescriptions 
  FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "Doctors can insert prescriptions"
  ON public.prescriptions 
  FOR INSERT 
  WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Doctors can update their own prescriptions"
  ON public.prescriptions 
  FOR UPDATE 
  USING (auth.uid() = doctor_id)
  WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Doctors can delete their own prescriptions"
  ON public.prescriptions 
  FOR DELETE 
  USING (auth.uid() = doctor_id);

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO authenticated;
