-- Fix data storage issue: Make handle_new_user() more resilient
-- The trigger was creating incomplete profiles because raw_user_meta_data is not passed
-- This migration makes it handle conflicts and allows frontend to update profiles

-- Modify handle_new_user to handle conflicts gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles with data from raw_user_meta_data (if provided)
  -- If no metadata provided, just insert the email and ID
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
  )
  ON CONFLICT (id) DO NOTHING; -- Ignore if already exists
  
  -- Insert role only if provided in metadata
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::app_role)
    ON CONFLICT (user_id, role) DO NOTHING; -- Ignore if already exists
  END IF;

  -- If doctor role is specified, create empty doctor profile (will be updated by frontend)
  IF NEW.raw_user_meta_data->>'role' = 'doctor' THEN
    INSERT INTO public.doctor_profiles (
      user_id,
      specialization,
      license_number
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'specialization', ''),
      COALESCE(NEW.raw_user_meta_data->>'license_number', '')
    )
    ON CONFLICT (user_id) DO NOTHING; -- Ignore if already exists
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the signup
  RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure on_auth_user_created trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add helpful comment
COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-create profile on user signup. Data from raw_user_meta_data if provided, otherwise incomplete profile is created and will be updated by frontend.';
