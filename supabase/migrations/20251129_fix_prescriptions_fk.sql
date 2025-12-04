-- Fix prescriptions table to support both appointments and emergency bookings
-- Drop the foreign key constraint on appointment_id
ALTER TABLE public.prescriptions 
DROP CONSTRAINT IF EXISTS prescriptions_appointment_id_fkey;

-- Make appointment_id nullable to support emergency bookings
ALTER TABLE public.prescriptions 
ALTER COLUMN appointment_id DROP NOT NULL;

-- Add emergency_booking_id column for tracking emergency booking prescriptions
ALTER TABLE public.prescriptions 
ADD COLUMN IF NOT EXISTS emergency_booking_id UUID REFERENCES public.emergency_bookings(id) ON DELETE CASCADE;

-- Create index for emergency_booking_id for faster queries
CREATE INDEX IF NOT EXISTS idx_prescriptions_emergency_booking_id ON public.prescriptions(emergency_booking_id);

-- Add a check constraint to ensure at least one of appointment_id or emergency_booking_id is set
ALTER TABLE public.prescriptions 
ADD CONSTRAINT check_prescription_reference 
CHECK (appointment_id IS NOT NULL OR emergency_booking_id IS NOT NULL);

-- Drop old trigger if it exists
DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON public.prescriptions;
DROP FUNCTION IF EXISTS public.update_prescriptions_timestamp();

-- Create function to auto-update updated_at column
CREATE FUNCTION public.update_prescriptions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_prescriptions_timestamp();

