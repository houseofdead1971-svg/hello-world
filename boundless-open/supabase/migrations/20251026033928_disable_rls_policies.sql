/*
  # Disable Row Level Security (RLS) on all tables
  
  This migration removes all RLS policies and disables RLS on all tables,
  making data accessible without authentication restrictions.
  
  WARNING: This removes all security restrictions on database access.
*/

-- Disable RLS on all tables
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.doctor_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.doctor_patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.health_timeline DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medication_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification_preferences DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reminders DISABLE ROW LEVEL SECURITY;

-- Drop all policies from profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Doctors can view assigned patient profiles" ON public.profiles;

-- Drop all policies from user_roles table
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own roles during signup" ON public.user_roles;

-- Drop all policies from doctor_profiles table
DROP POLICY IF EXISTS "Public can view verified doctors" ON public.doctor_profiles;
DROP POLICY IF EXISTS "Doctors can update own profile" ON public.doctor_profiles;
DROP POLICY IF EXISTS "Doctors can insert own profile" ON public.doctor_profiles;

-- Drop all policies from doctor_patients table
DROP POLICY IF EXISTS "Doctors can view their assigned patients" ON public.doctor_patients;
DROP POLICY IF EXISTS "Doctors can assign patients" ON public.doctor_patients;
DROP POLICY IF EXISTS "Doctors can update patient relationships" ON public.doctor_patients;
DROP POLICY IF EXISTS "Doctors can remove patient relationships" ON public.doctor_patients;

-- Drop all policies from health_timeline table
DROP POLICY IF EXISTS "Users can view own timeline" ON public.health_timeline;
DROP POLICY IF EXISTS "Users can insert own timeline" ON public.health_timeline;
DROP POLICY IF EXISTS "Users can update own timeline" ON public.health_timeline;
DROP POLICY IF EXISTS "Users can delete own timeline" ON public.health_timeline;
DROP POLICY IF EXISTS "Doctors can view assigned patients health timeline" ON public.health_timeline;

-- Drop all policies from medications table
DROP POLICY IF EXISTS "Users can view own medications" ON public.medications;
DROP POLICY IF EXISTS "Users can insert own medications" ON public.medications;
DROP POLICY IF EXISTS "Users can update own medications" ON public.medications;
DROP POLICY IF EXISTS "Users can delete own medications" ON public.medications;
DROP POLICY IF EXISTS "Doctors can view assigned patients medications" ON public.medications;

-- Drop all policies from medication_logs table
DROP POLICY IF EXISTS "Users can view own medication logs" ON public.medication_logs;
DROP POLICY IF EXISTS "Users can insert own medication logs" ON public.medication_logs;

-- Drop all policies from chat_messages table
DROP POLICY IF EXISTS "Users can view own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.chat_messages;

-- Drop all policies from appointments table
DROP POLICY IF EXISTS "Patients can view own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can update own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can view their appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can update their appointments" ON public.appointments;

-- Drop all policies from notification_preferences table
DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.notification_preferences;

-- Drop all policies from notifications table
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Drop all policies from reminders table
DROP POLICY IF EXISTS "Users can view own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can create own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can update own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can delete own reminders" ON public.reminders;

-- Drop storage policies
DROP POLICY IF EXISTS "Users can view own medical records" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own medical records" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own medical records" ON storage.objects;
DROP POLICY IF EXISTS "Doctors can view assigned patients medical records" ON storage.objects;
