-- Drop the problematic public policy that exposes all profile data
DROP POLICY IF EXISTS "Public can view doctor profiles" ON public.profiles;

-- Create a secure public view for doctor discovery that only exposes safe information
CREATE OR REPLACE VIEW public.public_doctors AS
SELECT 
  p.id,
  p.full_name,
  p.avatar_url,
  dp.specialization,
  dp.years_of_experience,
  dp.consultation_fee,
  dp.available_for_consultation,
  dp.hospital_affiliation
FROM public.profiles p
INNER JOIN public.doctor_profiles dp ON dp.user_id = p.id
WHERE dp.available_for_consultation = true;

-- Grant SELECT access to anonymous and authenticated users on the view
GRANT SELECT ON public.public_doctors TO anon, authenticated;

-- Add comment explaining the security considerations
COMMENT ON VIEW public.public_doctors IS 'Public view for doctor discovery. Excludes all sensitive information including emails, phone numbers, medical data, and license numbers.';
