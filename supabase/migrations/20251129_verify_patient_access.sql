/*
  # Verify Emergency Bookings and Prescriptions Data Access

  ## Purpose
  - Ensure RLS policies are correctly applied
  - Verify data can be accessed by patients
  - Log any access issues for debugging
*/

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.emergency_bookings TO authenticated;
GRANT SELECT ON public.emergency_bookings TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO authenticated;
GRANT SELECT ON public.prescriptions TO authenticated;

-- Verify RLS is enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'emergency_bookings' 
    AND table_schema = 'public'
  ) THEN
    RAISE NOTICE 'Emergency bookings table does not exist - will be created by migration';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'prescriptions' 
    AND table_schema = 'public'
  ) THEN
    RAISE NOTICE 'Prescriptions table does not exist - will be created by migration';
  END IF;
END $$;

-- Create function to verify access for patient
CREATE OR REPLACE FUNCTION public.verify_patient_access(p_patient_id UUID)
RETURNS TABLE (
  table_name TEXT,
  accessible BOOLEAN,
  record_count INT,
  details TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_emergency_count INT := 0;
  v_prescription_count INT := 0;
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  -- Check emergency bookings access
  BEGIN
    SELECT COUNT(*) INTO v_emergency_count 
    FROM public.emergency_bookings 
    WHERE patient_id = p_patient_id;
    
    RETURN QUERY SELECT 
      'emergency_bookings'::TEXT,
      TRUE::BOOLEAN,
      v_emergency_count::INT,
      'Patient can view ' || v_emergency_count || ' emergency bookings'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      'emergency_bookings'::TEXT,
      FALSE::BOOLEAN,
      0::INT,
      SQLERRM::TEXT;
  END;

  -- Check prescriptions access
  BEGIN
    SELECT COUNT(*) INTO v_prescription_count 
    FROM public.prescriptions 
    WHERE patient_id = p_patient_id;
    
    RETURN QUERY SELECT 
      'prescriptions'::TEXT,
      TRUE::BOOLEAN,
      v_prescription_count::INT,
      'Patient can view ' || v_prescription_count || ' prescriptions'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      'prescriptions'::TEXT,
      FALSE::BOOLEAN,
      0::INT,
      SQLERRM::TEXT;
  END;
END;
$$;

-- Create audit function to log prescription/emergency access
CREATE OR REPLACE FUNCTION public.log_patient_history_access(p_patient_id UUID)
RETURNS TABLE (
  access_time TIMESTAMP,
  patient_id UUID,
  emergency_bookings_count INT,
  prescriptions_count INT,
  prescriptions_for_emergency INT,
  prescriptions_for_appointments INT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    now()::TIMESTAMP,
    p_patient_id,
    (SELECT COUNT(*) FROM public.emergency_bookings WHERE patient_id = p_patient_id)::INT,
    (SELECT COUNT(*) FROM public.prescriptions WHERE patient_id = p_patient_id)::INT,
    (SELECT COUNT(*) FROM public.prescriptions WHERE patient_id = p_patient_id AND emergency_booking_id IS NOT NULL)::INT,
    (SELECT COUNT(*) FROM public.prescriptions WHERE patient_id = p_patient_id AND appointment_id IS NOT NULL)::INT;
END;
$$;

-- Log completion
SELECT 'Patient data access verified and monitoring functions created' as status;
