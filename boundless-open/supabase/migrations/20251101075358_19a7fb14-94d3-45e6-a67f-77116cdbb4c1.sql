-- Allow anyone to view profiles of available doctors
CREATE POLICY "Anyone can view available doctors profiles"
ON public.profiles
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM public.doctor_profiles 
    WHERE doctor_profiles.user_id = profiles.id 
    AND doctor_profiles.available_for_consultation = true
  )
);
