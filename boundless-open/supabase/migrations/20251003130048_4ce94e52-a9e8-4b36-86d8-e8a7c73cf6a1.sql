-- Fix the security definer issue by setting security_invoker=on for the view
-- This ensures the view respects RLS policies and runs with querying user's permissions
ALTER VIEW public.public_doctors SET (security_invoker = on);
