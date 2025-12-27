-- Fix RLS policies for doctor_patients table to allow doctors to assign patients
-- This ensures patient auto-assignment works when appointments are approved

DO $$
BEGIN
  -- Check if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'doctor_patients') THEN
    
    -- Enable RLS on doctor_patients if not already enabled
    ALTER TABLE public.doctor_patients ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist (to avoid conflicts)
    DROP POLICY IF EXISTS "Doctors can view their assigned patients" ON public.doctor_patients;
    DROP POLICY IF EXISTS "Doctors can insert patient assignments" ON public.doctor_patients;
    DROP POLICY IF EXISTS "Doctors can update their patient records" ON public.doctor_patients;
    DROP POLICY IF EXISTS "Patients can view their doctor assignments" ON public.doctor_patients;
    
    -- Policy 1: Doctors can view patients assigned to them
    CREATE POLICY "Doctors can view their assigned patients"
      ON public.doctor_patients
      FOR SELECT
      USING (doctor_id = auth.uid());
    
    -- Policy 2: Doctors can insert new patient assignments (for auto-assignment)
    CREATE POLICY "Doctors can insert patient assignments"
      ON public.doctor_patients
      FOR INSERT
      WITH CHECK (doctor_id = auth.uid());
    
    -- Policy 3: Doctors can update their patient records
    CREATE POLICY "Doctors can update their patient records"
      ON public.doctor_patients
      FOR UPDATE
      USING (doctor_id = auth.uid())
      WITH CHECK (doctor_id = auth.uid());
    
    -- Policy 4: Patients can view their doctor assignments
    CREATE POLICY "Patients can view their doctor assignments"
      ON public.doctor_patients
      FOR SELECT
      USING (patient_id = auth.uid());
    
    RAISE NOTICE 'RLS policies for doctor_patients table created successfully';
  ELSE
    RAISE NOTICE 'doctor_patients table does not exist yet';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error setting up RLS policies: %', SQLERRM;
END $$;
