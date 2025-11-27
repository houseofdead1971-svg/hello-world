-- Update public_doctors view to include avatar_url
DROP VIEW IF EXISTS public.public_doctors;

CREATE VIEW public.public_doctors AS
SELECT 
  dp.user_id as id,
  p.full_name,
  p.avatar_url,
  dp.specialization,
  dp.hospital_affiliation,
  dp.years_of_experience,
  dp.consultation_fee,
  dp.available_for_consultation
FROM doctor_profiles dp
JOIN profiles p ON dp.user_id = p.id
WHERE dp.available_for_consultation = true;
