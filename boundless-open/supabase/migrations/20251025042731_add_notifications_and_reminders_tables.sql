/*
  # Add Notifications and Reminders Tables (No RLS)
  
  ## Overview
  Adds missing tables: notifications and reminders without RLS policies
  
  ## Tables Created
  1. **notifications** - System and user notifications
     - id (uuid, primary key)
     - user_id (uuid, foreign key to auth.users)
     - title (text)
     - message (text)
     - type (text, default 'system')
     - read (boolean, default false)
     - link (text, optional)
     - created_at (timestamptz)
  
  2. **reminders** - User-created reminders
     - id (uuid, primary key)
     - user_id (uuid, foreign key to auth.users)
     - title (text)
     - description (text, optional)
     - reminder_type (text, default 'custom')
     - reminder_time (timestamptz)
     - repeat_pattern (text, optional)
     - active (boolean, default true)
     - created_at (timestamptz)
     - updated_at (timestamptz)
  
  ## Security
  - RLS is DISABLED on both tables
  - Full access granted to authenticated and anonymous users
*/

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'system',
  read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Reminders table
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reminder_type TEXT NOT NULL DEFAULT 'custom',
  reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
  repeat_pattern TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON public.reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_time ON public.reminders(reminder_time);
CREATE INDEX IF NOT EXISTS idx_reminders_active ON public.reminders(active);

-- Add trigger for reminders updated_at
DROP TRIGGER IF EXISTS update_reminders_updated_at ON public.reminders;
CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant full access to both tables (RLS disabled by default)
GRANT ALL ON public.notifications TO authenticated, anon;
GRANT ALL ON public.reminders TO authenticated, anon;
