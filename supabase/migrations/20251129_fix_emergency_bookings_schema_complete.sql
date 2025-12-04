/*
  # Fix Emergency Bookings Schema and RLS

  ## Issues Fixed
  1. Ensure all required columns exist (requested_at, scheduled_date, etc.)
  2. RLS policies properly configured
  3. Indexes optimized for patient history queries
  4. Trigger for updated_at timestamp
*/

-- Ensure all required columns exist
DO $$
BEGIN
  -- Add requested_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'emergency_bookings' AND column_name = 'requested_at'
  ) THEN
    ALTER TABLE public.emergency_bookings 
    ADD COLUMN requested_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;

  -- Add scheduled_date if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'emergency_bookings' AND column_name = 'scheduled_date'
  ) THEN
    ALTER TABLE public.emergency_bookings 
    ADD COLUMN scheduled_date TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add responded_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'emergency_bookings' AND column_name = 'responded_at'
  ) THEN
    ALTER TABLE public.emergency_bookings 
    ADD COLUMN responded_at TIMESTAMP WITH TIME ZONE;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Column addition note: %', SQLERRM;
END $$;

-- Drop and recreate RLS policies cleanly
DO $$
BEGIN
  DROP POLICY IF EXISTS "Patients can view own emergency bookings" ON public.emergency_bookings;
  DROP POLICY IF EXISTS "Patients can create own emergency bookings" ON public.emergency_bookings;
  DROP POLICY IF EXISTS "Patients can update own emergency bookings" ON public.emergency_bookings;
  DROP POLICY IF EXISTS "Doctors can view emergency bookings for their patients" ON public.emergency_bookings;
  DROP POLICY IF EXISTS "Doctors can update emergency bookings" ON public.emergency_bookings;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Recreate RLS policies
CREATE POLICY "Patients can view own emergency bookings"
  ON public.emergency_bookings FOR SELECT
  USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create own emergency bookings"
  ON public.emergency_bookings FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can update own emergency bookings"
  ON public.emergency_bookings FOR UPDATE
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Doctors can view and respond to emergency bookings"
  ON public.emergency_bookings FOR SELECT
  USING (auth.uid() = doctor_id OR auth.uid() = patient_id);

CREATE POLICY "Doctors can update emergency bookings"
  ON public.emergency_bookings FOR UPDATE
  USING (auth.uid() = doctor_id);

-- Ensure RLS is enabled
ALTER TABLE public.emergency_bookings ENABLE ROW LEVEL SECURITY;

-- Create or recreate indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_emergency_bookings_patient_id ON public.emergency_bookings(patient_id);
CREATE INDEX IF NOT EXISTS idx_emergency_bookings_doctor_id ON public.emergency_bookings(doctor_id);
CREATE INDEX IF NOT EXISTS idx_emergency_bookings_status ON public.emergency_bookings(status);

-- Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_emergency_bookings_patient_status 
  ON public.emergency_bookings(patient_id, status);

CREATE INDEX IF NOT EXISTS idx_emergency_bookings_patient_responded 
  ON public.emergency_bookings(patient_id, responded_at DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_bookings_patient_requested 
  ON public.emergency_bookings(patient_id, requested_at DESC);

-- Fix trigger - ensure updated_at is automatically maintained
DO $$
BEGIN
  DROP TRIGGER IF EXISTS update_emergency_bookings_updated_at ON public.emergency_bookings;
  DROP FUNCTION IF EXISTS public.update_emergency_bookings_updated_at();
  
  -- Try to use the global function
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'update_updated_at_column'
    AND routine_schema = 'public'
  ) THEN
    CREATE TRIGGER update_emergency_bookings_updated_at
      BEFORE UPDATE ON public.emergency_bookings
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  ELSE
    -- Create a local function if global doesn't exist
    CREATE FUNCTION public.update_emergency_bookings_updated_at()
    RETURNS TRIGGER AS $trigger$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql;
    
    CREATE TRIGGER update_emergency_bookings_updated_at
      BEFORE UPDATE ON public.emergency_bookings
      FOR EACH ROW
      EXECUTE FUNCTION public.update_emergency_bookings_updated_at();
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Trigger note: %', SQLERRM;
END $$;

-- Create helper view for patient history (for debugging/monitoring)
CREATE OR REPLACE VIEW public.vw_patient_appointment_history AS
SELECT 
  'regular' as type,
  a.id,
  a.patient_id,
  a.doctor_id,
  a.appointment_date,
  a.status,
  a.reason,
  a.notes,
  NULL::UUID as emergency_booking_id,
  NULL::TEXT as urgency_level,
  a.created_at
FROM public.appointments a
UNION ALL
SELECT 
  'emergency' as type,
  eb.id,
  eb.patient_id,
  eb.doctor_id,
  COALESCE(eb.responded_at, eb.scheduled_date, eb.requested_at) as appointment_date,
  eb.status,
  eb.reason,
  eb.doctor_notes as notes,
  eb.id as emergency_booking_id,
  eb.urgency_level,
  eb.created_at
FROM public.emergency_bookings eb;

-- Log completion
SELECT 'Emergency bookings table schema and RLS fixed' as migration_status;
