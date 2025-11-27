-- Allow doctors to view profiles of patients who have appointments with them
CREATE POLICY "Doctors can view appointment patients profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.appointments
    WHERE appointments.patient_id = profiles.id
    AND appointments.doctor_id = auth.uid()
  )
);
