-- Drop the overly permissive policy that allows indefinite access
DROP POLICY IF EXISTS "Doctors can view appointment patients profiles" ON public.profiles;

-- Create a time-bound access policy for doctors
-- Only allow access to patient profiles for:
-- 1. Upcoming appointments (within next 7 days)
-- 2. Recent appointments (within 2 days after the appointment)
-- This ensures doctors only access records when actively caring for the patient
CREATE POLICY "Doctors can view profiles for active appointments only"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM appointments
    WHERE appointments.patient_id = profiles.id
      AND appointments.doctor_id = auth.uid()
      AND appointments.appointment_date >= (now() - interval '2 days')
      AND appointments.appointment_date <= (now() + interval '7 days')
      AND appointments.status IN ('pending', 'confirmed', 'completed')
  )
);

-- Add comment explaining the security model
COMMENT ON POLICY "Doctors can view profiles for active appointments only" ON public.profiles IS 
'Time-bound access control: Doctors can only view patient profiles for appointments within 7 days in the future or 2 days in the past. This prevents indefinite access to patient medical records after the care relationship ends. For ongoing care relationships, use the doctor_patients table with active status.';
