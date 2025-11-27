/*
  # Create public_doctors view for listing available doctors
  
  ## Overview
  Creates a public view that combines doctor profiles with user information
  to provide a complete list of available doctors for patients.
  
  ## Tables Used
  - profiles (for full_name, avatar_url)
  - doctor_profiles (for specialization, experience, fees, etc.)
  - user_roles (to verify doctor role)
  
  ## Security
  - View is publicly readable
  - Only shows doctors who are available for consultation
  - Only includes verified doctors with doctor role
*/

-- Create public_doctors view
CREATE OR REPLACE VIEW public.public_doctors AS
SELECT 
  p.id,
  p.full_name,
  p.avatar_url,
  dp.specialization,
  dp.hospital_affiliation,
  dp.years_of_experience,
  dp.consultation_fee,
  dp.available_for_consultation
FROM public.profiles p
INNER JOIN public.doctor_profiles dp ON p.id = dp.user_id
INNER JOIN public.user_roles ur ON p.id = ur.user_id
WHERE ur.role = 'doctor'
  AND dp.available_for_consultation = true;

-- Grant select permission to authenticated users
GRANT SELECT ON public.public_doctors TO authenticated;
GRANT SELECT ON public.public_doctors TO anon;
