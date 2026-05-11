-- Allow agents to remove submitted shipments for their own customers.

CREATE OR REPLACE FUNCTION public.remove_submitted_shipment(p_shipment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT s.customer_id
  INTO v_customer_id
  FROM public.shipments s
  JOIN public.customers c ON c.id = s.customer_id
  WHERE s.id = p_shipment_id
    AND (
      s.status = 'requested_pickup'
      OR s.status = 'received' -- allow auto-submitted received parcel in customer/agent portal
    )
    AND (
      c.user_id = v_user_id
      OR c.agent_id = v_user_id
    )
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Submitted shipment not found or access denied.';
  END IF;

  IF NOT public.delete_shipment_record_internal(p_shipment_id) THEN
    RAISE EXCEPTION 'Submitted shipment could not be removed.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_submitted_shipment(uuid) TO authenticated;
