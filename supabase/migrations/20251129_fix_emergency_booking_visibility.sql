/*
  # Fix Emergency Bookings and Prescriptions Visibility in Patient History

  ## Problems
  - Emergency bookings not showing in patient appointment history
  - Prescriptions sent by doctor not visible for emergency bookings
  - RLS policies may be too restrictive for viewing history
  
  ## Solution
  - Ensure RLS allows patients to view all their emergency bookings (history)
  - Allow prescriptions to be fetched with emergency_booking_id
  - Verify prescriptions RLS for emergency bookings
*/

-- Fix emergency_bookings RLS policies to be more permissive for viewing
-- Patients should be able to see all their emergency bookings (pending, approved, rejected, completed)

DROP POLICY IF EXISTS "Patients can view own emergency bookings" ON public.emergency_bookings;
CREATE POLICY "Patients can view own emergency bookings"
ON public.emergency_bookings FOR SELECT
USING (auth.uid() = patient_id);

-- Ensure doctors can also view emergency bookings they are involved with
DROP POLICY IF EXISTS "Doctors can view emergency bookings for their patients" ON public.emergency_bookings;
CREATE POLICY "Doctors can view emergency bookings for their patients"
ON public.emergency_bookings FOR SELECT
USING (auth.uid() = doctor_id OR auth.uid() = patient_id);

-- Ensure prescriptions table has proper RLS for emergency bookings
-- Check that patients can view prescriptions for their emergency bookings

-- If prescriptions RLS exists, verify it allows viewing
DROP POLICY IF EXISTS "Allow read prescriptions for patients and doctors" ON public.prescriptions;
CREATE POLICY "Allow read prescriptions for patients and doctors"
ON public.prescriptions
FOR SELECT
USING (auth.uid() = patient_id OR auth.uid() = doctor_id);

-- Ensure indexes exist for efficient queries
CREATE INDEX IF NOT EXISTS idx_emergency_bookings_patient_id_status 
  ON public.emergency_bookings(patient_id, status);

CREATE INDEX IF NOT EXISTS idx_prescriptions_emergency_booking_id 
  ON public.prescriptions(emergency_booking_id);

-- Verify emergency_bookings table columns exist
-- (They should from the migration, but this ensures compatibility)
DO $$
BEGIN
  -- Add requested_at if it doesn't exist
  IF NOT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'emergency_bookings' AND column_name = 'requested_at'
  ) THEN
    ALTER TABLE public.emergency_bookings 
    ADD COLUMN requested_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;

  -- Add scheduled_date if it doesn't exist
  IF NOT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'emergency_bookings' AND column_name = 'scheduled_date'
  ) THEN
    ALTER TABLE public.emergency_bookings 
    ADD COLUMN scheduled_date TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create helper function to get emergency booking history with prescriptions
CREATE OR REPLACE FUNCTION public.get_patient_emergency_history(p_patient_id UUID)
RETURNS TABLE (
  id UUID,
  doctor_id UUID,
  status TEXT,
  urgency_level TEXT,
  reason TEXT,
  doctor_notes TEXT,
  requested_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  scheduled_date TIMESTAMP WITH TIME ZONE,
  prescription_count INT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eb.id,
    eb.doctor_id,
    eb.status,
    eb.urgency_level,
    eb.reason,
    eb.doctor_notes,
    eb.requested_at,
    eb.responded_at,
    eb.scheduled_date,
    COUNT(p.id)::INT as prescription_count
  FROM public.emergency_bookings eb
  LEFT JOIN public.prescriptions p ON p.emergency_booking_id = eb.id
  WHERE eb.patient_id = p_patient_id
  GROUP BY eb.id, eb.doctor_id, eb.status, eb.urgency_level, 
           eb.reason, eb.doctor_notes, eb.requested_at, eb.responded_at, eb.scheduled_date
  ORDER BY COALESCE(eb.responded_at, eb.requested_at) DESC;
END;
$$;

-- Log completion
SELECT 'Emergency bookings and prescriptions visibility fixed' as status;
