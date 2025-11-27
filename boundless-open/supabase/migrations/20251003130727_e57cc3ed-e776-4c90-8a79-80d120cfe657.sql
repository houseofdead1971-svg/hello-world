-- Grant public SELECT access to the public_doctors view
-- This view contains only non-sensitive doctor information for patient discovery
-- Security is controlled by the underlying doctor_profiles and profiles tables
GRANT SELECT ON public.public_doctors TO anon, authenticated;

-- Add comment explaining the security model for the view
COMMENT ON VIEW public.public_doctors IS
'Public doctor directory for appointment booking. This view exposes only non-sensitive information (name, specialization, availability, fees) required for patients to discover doctors. Sensitive data like license numbers and personal contact details remain protected in the underlying doctor_profiles table with strict RLS policies. Access is intentionally public to allow unauthenticated patients to browse available doctors.';
