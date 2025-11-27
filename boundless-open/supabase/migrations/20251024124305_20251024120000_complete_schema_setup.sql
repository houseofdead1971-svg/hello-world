/*
  # Data Well Connect - Complete Database Schema

  1. New Tables
    - `profiles` - User profile information (patients)
    - `user_roles` - User role management (patient, doctor, admin)
    - `doctor_profiles` - Doctor-specific information
    - `doctor_patients` - Doctor-patient relationships
    - `health_timeline` - Health events and records
    - `medications` - Medication tracking
    - `medication_logs` - Medication adherence logs
    - `chat_messages` - AI assistant conversation history
    - `appointments` - Appointment scheduling and management
    - `notification_preferences` - User notification settings

  2. Security
    - Enable RLS on all tables
    - Policies for user data isolation
    - Policies for doctor-patient data access
    - Public read access for doctor profiles
    - Doctors can view assigned patient profiles

  3. Functions & Triggers
    - `handle_new_user()` - Auto-create profiles on signup
    - `update_updated_at_column()` - Auto-update timestamps
    - `has_role()` - Role checking helper function

  4. Storage
    - `medical-records` bucket for file uploads
*/

-- Create role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('patient', 'doctor', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  date_of_birth DATE,
  phone TEXT,
  address TEXT,
  emergency_contact TEXT,
  blood_type TEXT,
  allergies TEXT[],
  gender TEXT,
  chronic_conditions TEXT[],
  medical_history TEXT,
  preferred_doctor_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own roles during signup" ON public.user_roles;
CREATE POLICY "Users can insert own roles during signup"
ON public.user_roles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create doctor_profiles table
CREATE TABLE IF NOT EXISTS public.doctor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  specialization TEXT NOT NULL DEFAULT '',
  license_number TEXT NOT NULL DEFAULT '',
  hospital_affiliation TEXT,
  years_of_experience INTEGER,
  consultation_fee DECIMAL(10,2),
  available_for_consultation BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view verified doctors" ON public.doctor_profiles;
CREATE POLICY "Public can view verified doctors"
ON public.doctor_profiles FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Doctors can update own profile" ON public.doctor_profiles;
CREATE POLICY "Doctors can update own profile"
ON public.doctor_profiles FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Doctors can insert own profile" ON public.doctor_profiles;
CREATE POLICY "Doctors can insert own profile"
ON public.doctor_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create doctor_patients relationship table
CREATE TABLE IF NOT EXISTS public.doctor_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(doctor_id, patient_id)
);

ALTER TABLE public.doctor_patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Doctors can view their assigned patients" ON public.doctor_patients;
CREATE POLICY "Doctors can view their assigned patients"
ON public.doctor_patients FOR SELECT
USING (
  auth.uid() = doctor_id OR 
  auth.uid() = patient_id
);

DROP POLICY IF EXISTS "Doctors can assign patients" ON public.doctor_patients;
CREATE POLICY "Doctors can assign patients"
ON public.doctor_patients FOR INSERT
WITH CHECK (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "Doctors can update patient relationships" ON public.doctor_patients;
CREATE POLICY "Doctors can update patient relationships"
ON public.doctor_patients FOR UPDATE
USING (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "Doctors can remove patient relationships" ON public.doctor_patients;
CREATE POLICY "Doctors can remove patient relationships"
ON public.doctor_patients FOR DELETE
USING (auth.uid() = doctor_id);

-- Add policy for doctors to view assigned patient profiles
DROP POLICY IF EXISTS "Doctors can view assigned patient profiles" ON public.profiles;
CREATE POLICY "Doctors can view assigned patient profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM doctor_patients
    WHERE doctor_patients.patient_id = profiles.id
      AND doctor_patients.doctor_id = auth.uid()
      AND doctor_patients.status = 'active'
  )
);

-- Create health_timeline table
CREATE TABLE IF NOT EXISTS public.health_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('appointment', 'lab', 'medication', 'symptom', 'procedure', 'other')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.health_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own timeline" ON public.health_timeline;
CREATE POLICY "Users can view own timeline"
  ON public.health_timeline FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own timeline" ON public.health_timeline;
CREATE POLICY "Users can insert own timeline"
  ON public.health_timeline FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own timeline" ON public.health_timeline;
CREATE POLICY "Users can update own timeline"
  ON public.health_timeline FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own timeline" ON public.health_timeline;
CREATE POLICY "Users can delete own timeline"
  ON public.health_timeline FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Doctors can view assigned patients health timeline" ON public.health_timeline;
CREATE POLICY "Doctors can view assigned patients health timeline"
ON public.health_timeline
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM doctor_patients
    WHERE doctor_patients.patient_id = health_timeline.user_id
      AND doctor_patients.doctor_id = auth.uid()
      AND doctor_patients.status = 'active'
  )
);

-- Create medications table
CREATE TABLE IF NOT EXISTS public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  time_of_day TEXT[],
  start_date DATE NOT NULL,
  end_date DATE,
  instructions TEXT,
  prescribing_doctor TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own medications" ON public.medications;
CREATE POLICY "Users can view own medications"
  ON public.medications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own medications" ON public.medications;
CREATE POLICY "Users can insert own medications"
  ON public.medications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own medications" ON public.medications;
CREATE POLICY "Users can update own medications"
  ON public.medications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own medications" ON public.medications;
CREATE POLICY "Users can delete own medications"
  ON public.medications FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Doctors can view assigned patients medications" ON public.medications;
CREATE POLICY "Doctors can view assigned patients medications"
ON public.medications
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM doctor_patients
    WHERE doctor_patients.patient_id = medications.user_id
      AND doctor_patients.doctor_id = auth.uid()
      AND doctor_patients.status = 'active'
  )
);

-- Create medication_logs table
CREATE TABLE IF NOT EXISTS public.medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  taken_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own medication logs" ON public.medication_logs;
CREATE POLICY "Users can view own medication logs"
  ON public.medication_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own medication logs" ON public.medication_logs;
CREATE POLICY "Users can insert own medication logs"
  ON public.medication_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own messages" ON public.chat_messages;
CREATE POLICY "Users can view own messages"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own messages" ON public.chat_messages;
CREATE POLICY "Users can insert own messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients can view own appointments" ON public.appointments;
CREATE POLICY "Patients can view own appointments"
ON public.appointments
FOR SELECT
USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Patients can create appointments" ON public.appointments;
CREATE POLICY "Patients can create appointments"
ON public.appointments
FOR INSERT
WITH CHECK (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Patients can update own appointments" ON public.appointments;
CREATE POLICY "Patients can update own appointments"
ON public.appointments
FOR UPDATE
USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Doctors can view their appointments" ON public.appointments;
CREATE POLICY "Doctors can view their appointments"
ON public.appointments
FOR SELECT
USING (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "Doctors can update their appointments" ON public.appointments;
CREATE POLICY "Doctors can update their appointments"
ON public.appointments
FOR UPDATE
USING (auth.uid() = doctor_id);

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  medication_reminders BOOLEAN DEFAULT true,
  appointment_reminders BOOLEAN DEFAULT true,
  health_tips BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view own notification preferences"
ON public.notification_preferences FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own notification preferences"
ON public.notification_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can update own notification preferences"
ON public.notification_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);

-- Create storage bucket for medical records
INSERT INTO storage.buckets (id, name, public) 
VALUES ('medical-records', 'medical-records', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for medical records
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view own medical records'
  ) THEN
    CREATE POLICY "Users can view own medical records"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'medical-records' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload own medical records'
  ) THEN
    CREATE POLICY "Users can upload own medical records"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'medical-records' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete own medical records'
  ) THEN
    CREATE POLICY "Users can delete own medical records"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'medical-records' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Doctors can view assigned patients medical records'
  ) THEN
    CREATE POLICY "Doctors can view assigned patients medical records"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'medical-records' AND
        EXISTS (
          SELECT 1 FROM doctor_patients
          WHERE doctor_patients.patient_id::text = (storage.foldername(name))[1]
            AND doctor_patients.doctor_id = auth.uid()
            AND doctor_patients.status = 'active'
        )
      );
  END IF;
END $$;

-- Trigger functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    CASE WHEN new.raw_user_meta_data->>'date_of_birth' IS NOT NULL 
      THEN (new.raw_user_meta_data->>'date_of_birth')::date 
      ELSE NULL END,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'blood_type',
    new.raw_user_meta_data->>'gender',
    new.raw_user_meta_data->>'emergency_contact',
    CASE WHEN new.raw_user_meta_data->>'allergies' IS NOT NULL 
      THEN ARRAY[new.raw_user_meta_data->>'allergies']::text[]
      ELSE NULL END,
    CASE WHEN new.raw_user_meta_data->>'chronic_conditions' IS NOT NULL 
      THEN ARRAY[new.raw_user_meta_data->>'chronic_conditions']::text[]
      ELSE NULL END
  );
  
  IF new.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, (new.raw_user_meta_data->>'role')::app_role);
  END IF;
  
  IF new.raw_user_meta_data->>'role' = 'doctor' THEN
    INSERT INTO public.doctor_profiles (
      user_id,
      specialization,
      license_number,
      hospital_affiliation
    )
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

-- Create triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
