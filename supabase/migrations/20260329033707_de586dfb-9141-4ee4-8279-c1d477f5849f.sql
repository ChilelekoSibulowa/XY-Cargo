CREATE OR REPLACE FUNCTION public.has_portal_access(_user_id uuid, _portal_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin') THEN true
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'staff') THEN
      EXISTS (SELECT 1 FROM staff_portal_assignments WHERE user_id = _user_id AND portal_id = _portal_id)
    ELSE false
  END
$$;