-- Create staff portal assignments table
CREATE TABLE public.staff_portal_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    portal_id text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    UNIQUE (user_id, portal_id)
);

-- Enable RLS
ALTER TABLE public.staff_portal_assignments ENABLE ROW LEVEL SECURITY;

-- Admin can manage all assignments
CREATE POLICY "Admin can manage portal assignments"
ON public.staff_portal_assignments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own assignments
CREATE POLICY "Users can view their own portal assignments"
ON public.staff_portal_assignments
FOR SELECT
USING (user_id = auth.uid());

-- Create function to check if user has access to a specific portal
CREATE OR REPLACE FUNCTION public.has_portal_access(_user_id uuid, _portal_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admins have access to all portals
  SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin') THEN true
    -- Staff needs explicit portal assignment
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'staff') THEN
      EXISTS (SELECT 1 FROM staff_portal_assignments WHERE user_id = _user_id AND portal_id = _portal_id)
    -- Other roles get default access based on their role
    ELSE true
  END
$$;

-- Create function to get all portals a user has access to
CREATE OR REPLACE FUNCTION public.get_user_portals(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(portal_id),
    ARRAY[]::text[]
  )
  FROM staff_portal_assignments
  WHERE user_id = _user_id
$$;