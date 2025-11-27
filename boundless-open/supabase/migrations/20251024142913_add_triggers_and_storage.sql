/*
  # Add triggers, auth function, storage, and views
*/

-- Add handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, date_of_birth, phone, blood_type, gender, emergency_contact, allergies, chronic_conditions
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    CASE WHEN new.raw_user_meta_data->>'date_of_birth' IS NOT NULL THEN (new.raw_user_meta_data->>'date_of_birth')::date ELSE NULL END,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'blood_type',
    new.raw_user_meta_data->>'gender',
    new.raw_user_meta_data->>'emergency_contact',
    CASE WHEN new.raw_user_meta_data->>'allergies' IS NOT NULL THEN ARRAY[new.raw_user_meta_data->>'allergies']::text[] ELSE NULL END,
    CASE WHEN new.raw_user_meta_data->>'chronic_conditions' IS NOT NULL THEN ARRAY[new.raw_user_meta_data->>'chronic_conditions']::text[] ELSE NULL END
  );
  
  IF new.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, (new.raw_user_meta_data->>'role')::app_role);
  END IF;
  
  IF new.raw_user_meta_data->>'role' = 'doctor' THEN
    INSERT INTO public.doctor_profiles (user_id, specialization, license_number, hospital_affiliation)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'specialization', ''),
      COALESCE(new.raw_user_meta_data->>'license_number', ''),
      new.raw_user_meta_data->>'hospital_affiliation'
    );
  END IF;
  
  RETURN new;
END;
$$;

-- Add auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add update triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_health_timeline_updated_at ON public.health_timeline;
CREATE TRIGGER update_health_timeline_updated_at
  BEFORE UPDATE ON public.health_timeline
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_medications_updated_at ON public.medications;
CREATE TRIGGER update_medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_doctor_profiles_updated_at ON public.doctor_profiles;
CREATE TRIGGER update_doctor_profiles_updated_at
BEFORE UPDATE ON public.doctor_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_doctor_patients_updated_at ON public.doctor_patients;
CREATE TRIGGER update_doctor_patients_updated_at
BEFORE UPDATE ON public.doctor_patients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for medical records
INSERT INTO storage.buckets (id, name, public) 
VALUES ('medical-records', 'medical-records', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can view own medical records') THEN
    CREATE POLICY "Users can view own medical records" ON storage.objects FOR SELECT
      USING (bucket_id = 'medical-records' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload own medical records') THEN
    CREATE POLICY "Users can upload own medical records" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'medical-records' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own medical records') THEN
    CREATE POLICY "Users can delete own medical records" ON storage.objects FOR DELETE
      USING (bucket_id = 'medical-records' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Doctors can view assigned patients medical records') THEN
    CREATE POLICY "Doctors can view assigned patients medical records" ON storage.objects FOR SELECT
      USING (bucket_id = 'medical-records' AND EXISTS (
        SELECT 1 FROM doctor_patients WHERE doctor_patients.patient_id::text = (storage.foldername(name))[1]
          AND doctor_patients.doctor_id = auth.uid() AND doctor_patients.status = 'active'
      ));
  END IF;
END $$;

-- Create public_doctors view
CREATE OR REPLACE VIEW public_doctors AS
SELECT 
  p.id,
  p.full_name,
  p.avatar_url,
  dp.specialization,
  dp.hospital_affiliation,
  dp.years_of_experience,
  dp.consultation_fee,
  dp.available_for_consultation
FROM profiles p
INNER JOIN doctor_profiles dp ON p.id = dp.user_id
WHERE dp.available_for_consultation = true;
