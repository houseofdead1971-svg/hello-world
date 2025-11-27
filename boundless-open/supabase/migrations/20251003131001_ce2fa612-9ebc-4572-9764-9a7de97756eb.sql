-- Allow doctors to view medications for their assigned patients
CREATE POLICY "Doctors can view assigned patients medications"
ON public.medications
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM doctor_patients
    WHERE doctor_patients.patient_id = medications.user_id
      AND doctor_patients.doctor_id = auth.uid()
      AND doctor_patients.status = 'active'
  )
);

-- Allow doctors to view health timeline for their assigned patients
CREATE POLICY "Doctors can view assigned patients health timeline"
ON public.health_timeline
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM doctor_patients
    WHERE doctor_patients.patient_id = health_timeline.user_id
      AND doctor_patients.doctor_id = auth.uid()
      AND doctor_patients.status = 'active'
  )
);

-- Add comments explaining the security model
COMMENT ON POLICY "Doctors can view assigned patients medications" ON public.medications IS
'Allows doctors to view medication information for patients they are actively assigned to through the doctor_patients relationship. This enables proper care coordination while maintaining patient privacy.';

COMMENT ON POLICY "Doctors can view assigned patients health timeline" ON public.health_timeline IS
'Allows doctors to view health events for patients they are actively assigned to through the doctor_patients relationship. This enables doctors to track patient health history for ongoing care.';
