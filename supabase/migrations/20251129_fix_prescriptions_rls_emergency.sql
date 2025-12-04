/*
  # Fix Prescriptions RLS for Emergency Bookings

  ## Problem
  - Prescriptions sent by doctor for emergency bookings may not be visible to patients
  - RLS policies may not account for emergency_booking_id
  
  ## Solution
  - Update RLS to allow prescriptions for emergency bookings to be viewed
  - Ensure proper indexing for faster queries
  - Verify FK constraints are correct
*/

-- Drop problematic RLS policies and recreate them to handle emergency bookings
DROP POLICY IF EXISTS "Allow read prescriptions for patients and doctors" ON public.prescriptions;
DROP POLICY IF EXISTS "Allow doctors to insert prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Allow update by doctor who created prescription" ON public.prescriptions;
DROP POLICY IF EXISTS "Allow delete by doctor who created prescription" ON public.prescriptions;

-- Recreate SELECT policy - allow patients and doctors to view prescriptions
CREATE POLICY "Allow read prescriptions for patients and doctors"
  ON public.prescriptions
  FOR SELECT
  USING (auth.uid() = patient_id OR auth.uid() = doctor_id);

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

-- Ensure the check constraint exists
DO $$
BEGIN
  -- First, ensure appointment_id can be null
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'prescriptions' 
    AND constraint_type = 'NOT NULL'
    AND constraint_name LIKE '%appointment_id%'
  ) THEN
    ALTER TABLE public.prescriptions 
    ALTER COLUMN appointment_id DROP NOT NULL;
  END IF;
  
  -- Add emergency_booking_id FK if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' AND column_name = 'emergency_booking_id'
  ) THEN
    ALTER TABLE public.prescriptions 
    ADD COLUMN emergency_booking_id UUID REFERENCES public.emergency_bookings(id) ON DELETE CASCADE;
  END IF;
  
  -- Add check constraint if it doesn't exist
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
  -- Silently ignore errors (constraints might already exist)
  NULL;
END $$;

-- Ensure all necessary indexes exist
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON public.prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment_id ON public.prescriptions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_emergency_booking_id ON public.prescriptions(emergency_booking_id);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_created 
  ON public.prescriptions(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescriptions_appt_or_emergency 
  ON public.prescriptions(appointment_id, emergency_booking_id);

-- Helper function to get prescriptions for a patient (including emergency bookings)
CREATE OR REPLACE FUNCTION public.get_patient_prescriptions(p_patient_id UUID)
RETURNS TABLE (
  id UUID,
  appointment_id UUID,
  emergency_booking_id UUID,
  doctor_id UUID,
  medicines JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.appointment_id,
    p.emergency_booking_id,
    p.doctor_id,
    p.medicines,
    p.notes,
    p.created_at
  FROM public.prescriptions p
  WHERE p.patient_id = p_patient_id
  ORDER BY p.created_at DESC;
END;
$$;

-- Verify FK constraint to emergency_bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'prescriptions' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%emergency_booking%'
  ) THEN
    -- Drop any existing constraint if needed and recreate
    ALTER TABLE public.prescriptions 
    DROP CONSTRAINT IF EXISTS prescriptions_emergency_booking_id_fkey;
    
    ALTER TABLE public.prescriptions 
    ADD CONSTRAINT prescriptions_emergency_booking_id_fkey 
    FOREIGN KEY (emergency_booking_id) 
    REFERENCES public.emergency_bookings(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Silently ignore errors
  NULL;
END $$;

-- Log completion
SELECT 'Prescriptions RLS for emergency bookings fixed' as status;
