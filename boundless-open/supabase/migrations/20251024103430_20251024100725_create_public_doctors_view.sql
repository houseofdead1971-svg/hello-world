/*
  # Create public_doctors view for doctor listings

  1. New Views
    - `public_doctors` - Public view of doctor profiles with user information
      - Joins doctor_profiles with profiles table
      - Shows only available doctors
      - Used for patient-facing doctor listings

  2. Security
    - View is accessible to authenticated users
    - Only shows doctors who are available for consultation
*/

-- Create a view that combines doctor profiles with user profiles
CREATE OR REPLACE VIEW public.public_doctors AS
SELECT 
  dp.user_id as id,
  p.full_name,
  p.avatar_url,
  dp.specialization,
  dp.hospital_affiliation,
  dp.years_of_experience,
  dp.consultation_fee,
  dp.available_for_consultation
FROM public.doctor_profiles dp
INNER JOIN public.profiles p ON p.id = dp.user_id
WHERE dp.available_for_consultation = true;
