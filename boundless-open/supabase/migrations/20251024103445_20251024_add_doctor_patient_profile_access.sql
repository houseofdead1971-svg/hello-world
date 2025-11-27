/*
  # Add doctor access to patient profiles

  1. New Policies
    - Allow doctors to view profiles of patients assigned to them
    
  2. Security
    - Doctors can only view profiles of patients in their doctor_patients table
    - Must have active relationship status
*/

-- Allow doctors to view patient profiles they are assigned to
DROP POLICY IF EXISTS "Doctors can view assigned patient profiles" ON public.profiles;
CREATE POLICY "Doctors can view assigned patient profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM doctor_patients
      WHERE doctor_patients.patient_id = profiles.id
        AND doctor_patients.doctor_id = auth.uid()
        AND doctor_patients.status = 'active'
    )
  );
