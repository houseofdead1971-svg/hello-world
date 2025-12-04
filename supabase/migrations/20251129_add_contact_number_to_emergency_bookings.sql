-- Add contact_number column to emergency_bookings table
ALTER TABLE public.emergency_bookings 
ADD COLUMN IF NOT EXISTS contact_number TEXT;
