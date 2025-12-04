/*
  # Add doctor_specialization column to prescriptions table

  ## Problem
  - Patient dashboard needs to display doctor specialization from prescriptions
  - Column may be missing from prescriptions table

  ## Solution
  - Add doctor_specialization column if it doesn't exist
  - Ensure all doctor info columns are present
*/

-- Add doctor_specialization column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' AND column_name = 'doctor_specialization'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN doctor_specialization TEXT;
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
END $$;

-- Create helpful comment on prescriptions table
COMMENT ON TABLE public.prescriptions IS 'Prescriptions can be linked via either appointment_id (regular appointments) or emergency_booking_id (emergency bookings). Doctor information is stored for quick access without joins.';

-- Log completion
SELECT 'Doctor specialization column added to prescriptions table' as status;
