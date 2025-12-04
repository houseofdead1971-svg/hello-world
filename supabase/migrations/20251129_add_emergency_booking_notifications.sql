-- Create trigger function to send notification when emergency booking is created
CREATE OR REPLACE FUNCTION public.notify_doctor_on_emergency_booking()
RETURNS TRIGGER AS $$
DECLARE
  patient_name TEXT;
  urgency_emoji TEXT;
BEGIN
  -- Get patient name
  SELECT full_name INTO patient_name FROM public.profiles WHERE id = NEW.patient_id;
  
  -- Determine emoji based on urgency level
  urgency_emoji := CASE NEW.urgency_level
    WHEN 'critical' THEN '🔴'
    WHEN 'high' THEN '🟠'
    WHEN 'medium' THEN '🟡'
    ELSE '🔵'
  END;

  -- Insert notification for doctor
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    link,
    created_at
  ) VALUES (
    NEW.doctor_id,
    'Emergency Booking Request ' || urgency_emoji,
    'Patient ' || COALESCE(patient_name, 'Unknown') || ' requested an emergency appointment (' || NEW.urgency_level || ' priority). Reason: ' || SUBSTRING(NEW.reason, 1, 100) || '...',
    'emergency_booking',
    '/dashboard',
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for emergency booking notifications
DROP TRIGGER IF EXISTS on_emergency_booking_created ON public.emergency_bookings;
CREATE TRIGGER on_emergency_booking_created
AFTER INSERT ON public.emergency_bookings
FOR EACH ROW
EXECUTE FUNCTION public.notify_doctor_on_emergency_booking();

-- Also create notification when doctor responds
CREATE OR REPLACE FUNCTION public.notify_patient_on_emergency_booking_response()
RETURNS TRIGGER AS $$
DECLARE
  doctor_name TEXT;
  status_message TEXT;
  status_emoji TEXT;
BEGIN
  -- Only trigger if status changed
  IF NEW.status != OLD.status THEN
    -- Get doctor name
    SELECT full_name INTO doctor_name FROM public.profiles WHERE id = NEW.doctor_id;
    
    -- Determine emoji based on status
    status_emoji := CASE NEW.status
      WHEN 'approved' THEN '✅'
      WHEN 'rejected' THEN '❌'
      WHEN 'completed' THEN '✔️'
      ELSE '⏳'
    END;

    status_message := CASE NEW.status
      WHEN 'approved' THEN 'Doctor approved your emergency booking request'
      WHEN 'rejected' THEN 'Doctor could not accept your emergency booking request'
      WHEN 'completed' THEN 'Your emergency consultation has been completed'
      ELSE 'Your emergency booking status has been updated'
    END;

    -- Insert notification for patient
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      link,
      created_at
    ) VALUES (
      NEW.patient_id,
      'Emergency Booking ' || status_emoji,
      'Dr. ' || COALESCE(doctor_name, 'Doctor') || ' ' || status_message || COALESCE('. Notes: ' || NEW.doctor_notes, ''),
      'emergency_booking',
      '/dashboard',
      now()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for emergency booking response notifications
DROP TRIGGER IF EXISTS on_emergency_booking_responded ON public.emergency_bookings;
CREATE TRIGGER on_emergency_booking_responded
AFTER UPDATE ON public.emergency_bookings
FOR EACH ROW
EXECUTE FUNCTION public.notify_patient_on_emergency_booking_response();
