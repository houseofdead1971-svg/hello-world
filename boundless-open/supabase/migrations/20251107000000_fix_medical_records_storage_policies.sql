-- Fix Medical Records Storage Policies and Create medical_records_meta Table
-- This migration ensures doctors can access patient medical records

-- Create medical_records_meta table
CREATE TABLE IF NOT EXISTS public.medical_records_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_medical_records_meta_file_path ON public.medical_records_meta(file_path);

ALTER TABLE public.medical_records_meta ENABLE ROW LEVEL SECURITY;

-- Patients manage their own records metadata
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'medical_records_meta' AND policyname = 'Patients can view own medical records metadata') THEN
    CREATE POLICY "Patients can view own medical records metadata"
      ON public.medical_records_meta FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'medical_records_meta' AND policyname = 'Patients can insert own medical records metadata') THEN
    CREATE POLICY "Patients can insert own medical records metadata"
      ON public.medical_records_meta FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'medical_records_meta' AND policyname = 'Patients can update own medical records metadata') THEN
    CREATE POLICY "Patients can update own medical records metadata"
      ON public.medical_records_meta FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'medical_records_meta' AND policyname = 'Patients can delete own medical records metadata') THEN
    CREATE POLICY "Patients can delete own medical records metadata"
      ON public.medical_records_meta FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'medical_records_meta' AND policyname = 'Doctors can view assigned patient medical records metadata') THEN
    CREATE POLICY "Doctors can view assigned patient medical records metadata"
      ON public.medical_records_meta FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.doctor_patients
          WHERE doctor_patients.doctor_id = auth.uid()
            AND doctor_patients.patient_id = medical_records_meta.user_id
            AND doctor_patients.status = 'active'
        )
      );
  END IF;
END $$;

-- Trigger to keep updated_at synced
DROP TRIGGER IF EXISTS trg_medical_records_meta_updated_at ON public.medical_records_meta;
CREATE TRIGGER trg_medical_records_meta_updated_at
  BEFORE UPDATE ON public.medical_records_meta
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure storage bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('medical-records', 'medical-records', false)
ON CONFLICT (id) DO NOTHING;

-- Fix storage policies for medical records
DO $$ 
BEGIN
  -- Drop existing policies if they exist (to avoid conflicts)
  DROP POLICY IF EXISTS "Users can view their own medical records" ON storage.objects;
  DROP POLICY IF EXISTS "Users can view own medical records" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload their own medical records" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload own medical records" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own medical records" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update own medical records" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own medical records" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own medical records" ON storage.objects;
  DROP POLICY IF EXISTS "Doctors can view assigned patient records" ON storage.objects;
  DROP POLICY IF EXISTS "Doctors can view assigned patients medical records" ON storage.objects;

  -- Create user policies
  CREATE POLICY "Users can view own medical records"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'medical-records' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );

  CREATE POLICY "Users can upload own medical records"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'medical-records' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );

  CREATE POLICY "Users can update own medical records"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'medical-records' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );

  CREATE POLICY "Users can delete own medical records"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'medical-records' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );

  -- Create doctor policy to view assigned patient records
  CREATE POLICY "Doctors can view assigned patient records"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'medical-records' AND
      EXISTS (
        SELECT 1 FROM public.doctor_patients
        WHERE doctor_patients.doctor_id = auth.uid()
          AND doctor_patients.patient_id::text = (storage.foldername(name))[1]
          AND doctor_patients.status = 'active'
      )
    );
END $$;

