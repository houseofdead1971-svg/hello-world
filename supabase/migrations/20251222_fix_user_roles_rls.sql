-- Fix user_roles RLS to allow proper signup flow
-- Problem: After OTP verification, inserting into user_roles fails due to RLS
-- Solution: Enable RLS but allow users to insert their own role during signup

-- Ensure table exists and has proper structure
DO $$
BEGIN
  -- Create table if it doesn't exist
  CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor')),
    created_at timestamp with time zone DEFAULT now()
  );
  
  -- Add role constraint if table already exists
  ALTER TABLE public.user_roles ADD CONSTRAINT check_valid_role CHECK (role IN ('patient', 'doctor'));
EXCEPTION WHEN OTHERS THEN
  -- Table might already exist or constraint already added
  NULL;
END $$;

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role during signup" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can read user roles" ON public.user_roles;

-- Policy 1: Users can view their own role
CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Policy 2: Users can insert their own role (during signup via OTP)
-- Also allow service role for admin operations
CREATE POLICY "Users can insert own role during signup"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Policy 3: Users can update their own role (limited - usually not needed)
CREATE POLICY "Users can update own role"
  ON public.user_roles FOR UPDATE
  USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Create index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Grant permissions
GRANT SELECT ON public.user_roles TO authenticated;
GRANT INSERT ON public.user_roles TO authenticated;
GRANT UPDATE ON public.user_roles TO authenticated;

-- Add comment
COMMENT ON TABLE public.user_roles IS 'Stores user role assignments (patient, doctor, admin)';
COMMENT ON COLUMN public.user_roles.user_id IS 'Reference to auth.users(id)';
COMMENT ON COLUMN public.user_roles.role IS 'User role: patient, doctor, or admin';
