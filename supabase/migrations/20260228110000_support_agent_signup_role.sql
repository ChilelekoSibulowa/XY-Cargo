-- Support role-aware public signup so new users can register as customer or agent.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_role public.app_role := 'customer'::public.app_role;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'requested_role', '') = 'agent' THEN
    v_requested_role := 'agent'::public.app_role;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_requested_role);

  RETURN NEW;
END;
$$;
