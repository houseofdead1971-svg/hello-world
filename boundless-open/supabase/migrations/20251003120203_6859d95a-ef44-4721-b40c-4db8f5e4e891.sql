-- Allow doctors to update profiles of their assigned patients
CREATE POLICY "Doctors can update assigned patients profiles"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.doctor_patients
    WHERE doctor_patients.patient_id = profiles.id
    AND doctor_patients.doctor_id = auth.uid()
    AND doctor_patients.status = 'active'
  )
);
