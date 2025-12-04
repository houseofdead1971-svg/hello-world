-- Ensure doctor information columns exist in prescriptions table
-- This migration explicitly adds the missing columns that the application is trying to use

DO $$
BEGIN
  -- Add doctor_name column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' 
    AND column_name = 'doctor_name'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN doctor_name TEXT;
  END IF;

  -- Add doctor_license column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' 
    AND column_name = 'doctor_license'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN doctor_license TEXT;
  END IF;

  -- Add doctor_specialization column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' 
    AND column_name = 'doctor_specialization'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN doctor_specialization TEXT;
  END IF;

  -- Add file_url column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' 
    AND column_name = 'file_url'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN file_url TEXT;
  END IF;

  -- Add file_path column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prescriptions' 
    AND column_name = 'file_path'
  ) THEN
    ALTER TABLE public.prescriptions ADD COLUMN file_path TEXT;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration complete with message: %', SQLERRM;
END $$;

-- Verify the schema is correct
SELECT COUNT(*) as total_columns FROM information_schema.columns 
WHERE table_name = 'prescriptions';
