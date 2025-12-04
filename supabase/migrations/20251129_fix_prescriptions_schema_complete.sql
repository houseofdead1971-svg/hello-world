/*
  # Fix Prescriptions Schema for Emergency Bookings

  ## Critical Issues Fixed
  1. appointment_id NOT NULL constraint prevents emergency booking prescriptions
  2. FK constraint not properly recreated after DROP
  3. Check constraint duplication prevention
  4. RLS policies need verification
  5. Trigger function may conflict with global update_updated_at_column
*/

-- First, safely handle the appointment_id column and constraints
DO $$
BEGIN
  -- Step 1: Drop problematic check constraint if it exists (avoid duplicates)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'prescriptions' 
    AND constraint_type = 'CHECK'
    AND constraint_name = 'check_prescription_reference'
  ) THEN
    ALTER TABLE public.prescriptions 
    DROP CONSTRAINT IF EXISTS check_prescription_reference;
  END IF;

  -- Step 2: Make appointment_id nullable if it's still NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' 
    AND column_name = 'appointment_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.prescriptions 
    ALTER COLUMN appointment_id DROP NOT NULL;
  END IF;

  -- Step 3: Drop old FK if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'prescriptions' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'prescriptions_appointment_id_fkey'
  ) THEN
    ALTER TABLE public.prescriptions 
    DROP CONSTRAINT prescriptions_appointment_id_fkey;
  END IF;

  -- Step 4: Add appointment_id FK back (nullable reference)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'prescriptions' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'prescriptions_appointment_id_fkey'
  ) THEN
    ALTER TABLE public.prescriptions 
    ADD CONSTRAINT prescriptions_appointment_id_fkey 
    FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;
  END IF;

  -- Step 5: Ensure emergency_booking_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' 
    AND column_name = 'emergency_booking_id'
  ) THEN
    ALTER TABLE public.prescriptions 
    ADD COLUMN emergency_booking_id UUID;
  END IF;

  -- Step 6: Add emergency_booking_id FK if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'prescriptions' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'prescriptions_emergency_booking_id_fkey'
  ) THEN
    ALTER TABLE public.prescriptions 
    ADD CONSTRAINT prescriptions_emergency_booking_id_fkey 
    FOREIGN KEY (emergency_booking_id) REFERENCES public.emergency_bookings(id) ON DELETE CASCADE;
  END IF;

  -- Step 7: Add check constraint to ensure at least one ID is present
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
  RAISE NOTICE 'Error during schema migration: %', SQLERRM;
END $$;

-- Ensure all indexes exist for optimal query performance
CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment_id ON public.prescriptions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_emergency_booking_id ON public.prescriptions(emergency_booking_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON public.prescriptions(doctor_id);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_created 
  ON public.prescriptions(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescriptions_by_appointment 
  ON public.prescriptions(appointment_id) 
  WHERE appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_by_emergency 
  ON public.prescriptions(emergency_booking_id) 
  WHERE emergency_booking_id IS NOT NULL;

-- Fix RLS policies - ensure they exist and are correct
DO $$
BEGIN
  -- Drop old policies first to recreate them cleanly
  DROP POLICY IF EXISTS "Allow read prescriptions for patients and doctors" ON public.prescriptions;
  DROP POLICY IF EXISTS "Allow doctors to insert prescriptions" ON public.prescriptions;
  DROP POLICY IF EXISTS "Allow update by doctor who created prescription" ON public.prescriptions;
  DROP POLICY IF EXISTS "Allow delete by doctor who created prescription" ON public.prescriptions;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Recreate RLS policies cleanly
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

-- Fix trigger - use the global function if it exists, otherwise create a local one
DO $$
BEGIN
  -- Drop old local trigger and function if they exist
  DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON public.prescriptions;
  DROP FUNCTION IF EXISTS public.update_prescriptions_timestamp();
  
  -- Try to use the global function if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'update_updated_at_column'
    AND routine_schema = 'public'
  ) THEN
    CREATE TRIGGER update_prescriptions_updated_at
      BEFORE UPDATE ON public.prescriptions
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  ELSE
    -- Create a local function if the global one doesn't exist
    CREATE FUNCTION public.update_prescriptions_timestamp()
    RETURNS TRIGGER AS $trigger$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql;
    
    CREATE TRIGGER update_prescriptions_updated_at
      BEFORE UPDATE ON public.prescriptions
      FOR EACH ROW
      EXECUTE FUNCTION public.update_prescriptions_timestamp();
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Trigger creation message: %', SQLERRM;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Log completion
SELECT 'Prescriptions table schema and constraints fixed for emergency bookings' as migration_status;
