-- Drop the public policy that exposes license numbers and sensitive doctor data
DROP POLICY IF EXISTS "Public can view verified doctors" ON public.doctor_profiles;

-- The public_doctors view created earlier now handles safe public access
-- without exposing license_number, user_id, or other sensitive fields

-- Add comment explaining the security model
COMMENT ON TABLE public.doctor_profiles IS 'Contains sensitive doctor information including license numbers. Access restricted to doctors themselves and authorized users. Public discovery uses the public_doctors view instead.';
