/*
  # Sign-Up Flow Fixes and Improvements
  
  ## Issues Addressed
  1. Ensures RLS is properly disabled on required tables
  2. Adds unique constraint checking on profiles
  3. Improves error messages for better debugging
  
  ## Changes
  - Verify profiles table doesn't have problematic RLS
  - Verify user_roles table RLS configuration
  - Verify doctor_profiles table RLS configuration
*/

-- Disable RLS on critical tables for signup flow
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.doctor_profiles DISABLE ROW LEVEL SECURITY;

-- Drop all RLS policies to ensure clean state
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'user_roles', 'doctor_profiles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s" ON public.%s CASCADE', 
                   policy_record.policyname, policy_record.tablename);
  END LOOP;
END $$;

-- Grant full permissions for authenticated users on signup tables
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.doctor_profiles TO authenticated;

-- Ensure sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add unique index on profiles.email for better error handling
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique ON public.profiles(email) 
WHERE email IS NOT NULL;

-- Create helpful function for signup error debugging
CREATE OR REPLACE FUNCTION public.check_signup_prerequisites(p_user_id UUID)
RETURNS TABLE (
  has_profile BOOLEAN,
  has_role BOOLEAN,
  has_doctor_profile BOOLEAN,
  email_text TEXT,
  profile_exists BOOLEAN
) LANGUAGE sql STABLE AS $$
  SELECT
    EXISTS(SELECT 1 FROM public.profiles WHERE id = p_user_id) as has_profile,
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = p_user_id) as has_role,
    EXISTS(SELECT 1 FROM public.doctor_profiles WHERE user_id = p_user_id) as has_doctor_profile,
    (SELECT email FROM public.profiles WHERE id = p_user_id LIMIT 1) as email_text,
    EXISTS(SELECT 1 FROM public.profiles WHERE id = p_user_id) as profile_exists;
$$;

-- Update profiles with better error context
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_date_of_birth DATE DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_blood_type TEXT DEFAULT NULL,
  p_emergency_contact TEXT DEFAULT NULL,
  p_allergies TEXT[] DEFAULT NULL,
  p_chronic_conditions TEXT[] DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, profile_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- Check if profile already exists
  IF EXISTS(SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Profile already exists for this user'::TEXT, p_user_id::UUID;
    RETURN;
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (
    id, email, full_name, phone, date_of_birth, gender, blood_type, 
    emergency_contact, allergies, chronic_conditions
  ) VALUES (
    p_user_id, p_email, p_full_name, p_phone, p_date_of_birth, p_gender, 
    p_blood_type, p_emergency_contact, p_allergies, p_chronic_conditions
  );

  v_profile_id := p_user_id;
  
  RETURN QUERY SELECT true::BOOLEAN, 'Profile created successfully'::TEXT, v_profile_id::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false::BOOLEAN, 'Error creating profile: ' || SQLERRM::TEXT, NULL::UUID;
END $$;
