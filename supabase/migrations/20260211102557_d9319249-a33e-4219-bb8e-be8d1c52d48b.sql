-- Fix: Restrict system_settings SELECT to admin/staff only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone authenticated can view settings" ON public.system_settings;

-- Create a restrictive policy for admin/staff only
CREATE POLICY "Admin/Staff can view settings"
ON public.system_settings
FOR SELECT
USING (is_admin_or_staff(auth.uid()));
