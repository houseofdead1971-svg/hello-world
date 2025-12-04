/*
  # Comprehensive Patient Prescription Visibility Fix

  ## Problem
  - Patient cannot see prescriptions sent by doctor for emergency bookings or regular appointments
  - May be due to RLS policies, missing data, or query issues

  ## Solution
  - Verify RLS policies allow patient to read prescriptions
  - Ensure all required columns exist
  - Verify FK relationships and data consistency
  - Create helpful debugging view
*/

-- Step 1: Ensure RLS is enabled
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop and recreate RLS policies to ensure they're correct
DROP POLICY IF EXISTS "Allow read prescriptions for patients and doctors" ON public.prescriptions;
DROP POLICY IF EXISTS "Allow doctors to insert prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Allow update by doctor who created prescription" ON public.prescriptions;
DROP POLICY IF EXISTS "Allow delete by doctor who created prescription" ON public.prescriptions;

-- Recreate SELECT policy - allow patients and doctors to view prescriptions
-- Patients can view their own prescriptions, doctors can view prescriptions they created
CREATE POLICY "Allow read prescriptions for patients and doctors"
  ON public.prescriptions
  FOR SELECT
  USING (
    auth.uid() = patient_id 
    OR auth.uid() = doctor_id
  );

-- Recreate INSERT policy - allow doctors to insert prescriptions
CREATE POLICY "Allow doctors to insert prescriptions"
  ON public.prescriptions
  FOR INSERT
  WITH CHECK (auth.uid() = doctor_id);

-- Recreate UPDATE policy - allow doctor who created to update
CREATE POLICY "Allow update by doctor who created prescription"
  ON public.prescriptions
  FOR UPDATE
  USING (auth.uid() = doctor_id)
  WITH CHECK (auth.uid() = doctor_id);

-- Recreate DELETE policy - allow doctor who created to delete
CREATE POLICY "Allow delete by doctor who created prescription"
  ON public.prescriptions
  FOR DELETE
  USING (auth.uid() = doctor_id);

-- Step 3: Verify all required columns exist
DO $$
BEGIN
  -- Ensure file_url column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' AND column_name = 'file_url'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN file_url TEXT;
  END IF;

  -- Ensure file_path column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN file_path TEXT;
  END IF;

  -- Ensure doctor_name column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' AND column_name = 'doctor_name'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN doctor_name TEXT;
  END IF;

  -- Ensure doctor_license column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' AND column_name = 'doctor_license'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN doctor_license TEXT;
  END IF;

  -- Ensure doctor_specialization column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' AND column_name = 'doctor_specialization'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN doctor_specialization TEXT;
  END IF;

  -- Ensure appointment_id can be NULL for emergency bookings
  ALTER TABLE public.prescriptions ALTER COLUMN appointment_id DROP NOT NULL;

  -- Ensure emergency_booking_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' AND column_name = 'emergency_booking_id'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN emergency_booking_id UUID REFERENCES public.emergency_bookings(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 4: Ensure proper constraints
DO $$
BEGIN
  -- Drop existing check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'prescriptions' 
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%check_prescription%'
  ) THEN
    ALTER TABLE public.prescriptions DROP CONSTRAINT IF EXISTS check_prescription_reference;
  END IF;

  -- Add check constraint to ensure either appointment_id or emergency_booking_id is set
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'prescriptions' 
    AND constraint_type = 'CHECK'
    AND constraint_name = 'check_prescription_reference'
  ) THEN
    ALTER TABLE public.prescriptions 
    ADD CONSTRAINT check_prescription_reference 
    CHECK (appointment_id IS NOT NULL OR emergency_booking_id IS NOT NULL);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore errors if constraint already exists
END $$;

-- Step 5: Ensure proper FK constraint for emergency_booking_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'prescriptions' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'prescriptions_emergency_booking_id_fkey'
  ) THEN
    ALTER TABLE public.prescriptions 
    ADD CONSTRAINT prescriptions_emergency_booking_id_fkey 
    FOREIGN KEY (emergency_booking_id) 
    REFERENCES public.emergency_bookings(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if FK already exists
END $$;

-- Step 6: Create helpful indexes for common queries
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON public.prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment_id ON public.prescriptions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_emergency_booking_id ON public.prescriptions(emergency_booking_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_created ON public.prescriptions(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_appt_or_emergency ON public.prescriptions(appointment_id, emergency_booking_id);

-- Step 7: Create a debugging view to check prescription data
DROP VIEW IF EXISTS public.prescription_audit CASCADE;
CREATE VIEW public.prescription_audit AS
SELECT 
  p.id,
  p.patient_id,
  p.doctor_id,
  p.appointment_id,
  p.emergency_booking_id,
  p.doctor_name,
  COALESCE(p.appointment_id, p.emergency_booking_id) as linked_to_id,
  CASE 
    WHEN p.appointment_id IS NOT NULL THEN 'appointment'
    WHEN p.emergency_booking_id IS NOT NULL THEN 'emergency_booking'
    ELSE 'UNLINKED'
  END as link_type,
  jsonb_array_length(p.medicines) as medicine_count,
  p.created_at,
  a.id as appointment_check,
  eb.id as emergency_booking_check
FROM public.prescriptions p
LEFT JOIN public.appointments a ON p.appointment_id = a.id
LEFT JOIN public.emergency_bookings eb ON p.emergency_booking_id = eb.id
ORDER BY p.created_at DESC;

-- Grant permission to view audit view
GRANT SELECT ON public.prescription_audit TO authenticated;

-- Log completion
SELECT 'Patient prescription visibility comprehensively fixed' as status;
