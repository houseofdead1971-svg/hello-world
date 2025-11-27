-- Allow public to view doctor profiles (for those who are doctors)
CREATE POLICY "Public can view doctor profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.doctor_profiles
    WHERE doctor_profiles.user_id = profiles.id
  )
);
