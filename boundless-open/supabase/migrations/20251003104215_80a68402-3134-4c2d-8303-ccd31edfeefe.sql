-- Create trigger to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles with additional metadata
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name,
    date_of_birth,
    phone,
    blood_type,
    gender,
    emergency_contact,
    allergies,
    chronic_conditions
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'date_of_birth')::date 
      ELSE NULL END,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'blood_type',
    NEW.raw_user_meta_data->>'gender',
    NEW.raw_user_meta_data->>'emergency_contact',
    CASE WHEN NEW.raw_user_meta_data->>'allergies' IS NOT NULL 
      THEN ARRAY[NEW.raw_user_meta_data->>'allergies']::text[]
      ELSE NULL END,
    CASE WHEN NEW.raw_user_meta_data->>'chronic_conditions' IS NOT NULL 
      THEN ARRAY[NEW.raw_user_meta_data->>'chronic_conditions']::text[]
      ELSE NULL END
  );
  
  -- Insert role
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::app_role);
  END IF;
  
  -- If doctor, create doctor profile
  IF NEW.raw_user_meta_data->>'role' = 'doctor' THEN
    INSERT INTO public.doctor_profiles (
      user_id,
      specialization,
      license_number,
      hospital_affiliation
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'specialization', ''),
      COALESCE(NEW.raw_user_meta_data->>'license_number', ''),
      NEW.raw_user_meta_data->>'hospital_affiliation'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create medical-records storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-records', 'medical-records', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for medical-records bucket
CREATE POLICY "Users can view their own medical records"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'medical-records' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own medical records"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'medical-records' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own medical records"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'medical-records' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own medical records"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'medical-records' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Doctors can view patient medical records they're assigned to
CREATE POLICY "Doctors can view assigned patient records"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'medical-records' AND
  EXISTS (
    SELECT 1 FROM public.doctor_patients
    WHERE doctor_id = auth.uid()
    AND patient_id::text = (storage.foldername(name))[1]
    AND status = 'active'
  )
);
