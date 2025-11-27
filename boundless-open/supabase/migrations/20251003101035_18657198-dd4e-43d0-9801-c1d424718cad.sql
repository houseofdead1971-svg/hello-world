-- Create role enum
CREATE TYPE public.app_role AS ENUM ('patient', 'doctor', 'admin');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

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

-- RLS policies for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own roles during signup"
ON public.user_roles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Update profiles table for patient information
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS chronic_conditions TEXT[],
ADD COLUMN IF NOT EXISTS medical_history TEXT;

-- Create doctor_profiles table
CREATE TABLE public.doctor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  specialization TEXT NOT NULL,
  license_number TEXT NOT NULL,
  hospital_affiliation TEXT,
  years_of_experience INTEGER,
  consultation_fee DECIMAL(10,2),
  available_for_consultation BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on doctor_profiles
ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for doctor_profiles
CREATE POLICY "Public can view verified doctors"
ON public.doctor_profiles FOR SELECT
USING (true);

CREATE POLICY "Doctors can update own profile"
ON public.doctor_profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Doctors can insert own profile"
ON public.doctor_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add trigger for doctor_profiles updated_at
CREATE TRIGGER update_doctor_profiles_updated_at
BEFORE UPDATE ON public.doctor_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update handle_new_user function to handle roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Insert role
  IF new.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, (new.raw_user_meta_data->>'role')::app_role);
  END IF;
  
  -- If doctor, create doctor profile
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
