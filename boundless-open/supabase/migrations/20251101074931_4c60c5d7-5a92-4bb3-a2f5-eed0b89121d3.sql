-- Allow patients to view doctor profiles (public access for available doctors)
CREATE POLICY "Anyone can view available doctor profiles"
ON public.doctor_profiles
FOR SELECT
TO public
USING (available_for_consultation = true);

-- Ensure the public_doctors view is accessible
-- Note: Views inherit RLS from underlying tables, so the above policy should be sufficient
