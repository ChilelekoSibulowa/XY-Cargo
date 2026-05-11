BEGIN;

CREATE OR REPLACE FUNCTION public.shipment_airway_bill_from_notes(_notes text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(BTRIM((regexp_match(COALESCE(_notes, ''), '(?i)AWB/BL No\.\s*:\s*([^|]+)'))[1]), ''),
    NULLIF(BTRIM((regexp_match(COALESCE(_notes, ''), '(?i)Airway Bill\s*:\s*([^|]+)'))[1]), ''),
    NULLIF(BTRIM((regexp_match(COALESCE(_notes, ''), '(?i)Bill of Lading\s*:\s*([^|]+)'))[1]), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.shipment_cbm_from_notes(_notes text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH extracted AS (
    SELECT NULLIF(BTRIM(SUBSTRING(COALESCE(_notes, '') FROM '(?i)CBM:\s*([^|]+)')), '') AS value
  )
  SELECT CASE
    WHEN value ~ '^-?[0-9]+(\.[0-9]+)?$' THEN value::numeric
    ELSE NULL
  END
  FROM extracted;
$$;

CREATE OR REPLACE FUNCTION public.shipsgo_transport_from_service_type(_service_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(BTRIM(COALESCE(_service_type, ''))) IN ('air', 'air freight', 'air_freight') THEN 'air'
    WHEN lower(BTRIM(COALESCE(_service_type, ''))) IN ('sea', 'sea freight', 'sea_freight', 'ocean', 'ocean freight', 'ocean_freight') THEN 'ocean'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.track_shipment_details_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lookup text := NULLIF(BTRIM(p_code), '');
  v_result jsonb;
  v_direct_consolidation_id uuid;
  v_matched_shipment_id uuid;
  v_parent_consolidation_id uuid;
  v_target_consolidation_id uuid;
BEGIN
  IF v_lookup IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT c.id
  INTO v_direct_consolidation_id
  FROM public.consolidations c
  WHERE lower(COALESCE(NULLIF(BTRIM(c.code), ''), '')) = lower(v_lookup)
     OR lower(COALESCE(NULLIF(BTRIM(c.tracking_code), ''), '')) = lower(v_lookup)
  ORDER BY COALESCE(c.updated_at, c.created_at) DESC, c.created_at DESC, c.id DESC
  LIMIT 1;

  SELECT s.id
  INTO v_matched_shipment_id
  FROM public.shipments s
  WHERE lower(COALESCE(NULLIF(BTRIM(s.code), ''), '')) = lower(v_lookup)
     OR lower(COALESCE(NULLIF(BTRIM(s.custom_tracking_number), ''), '')) = lower(v_lookup)
     OR lower(COALESCE(public.shipment_airway_bill_from_notes(s.notes), '')) = lower(v_lookup)
  ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.created_at DESC, s.id DESC
  LIMIT 1;

  IF v_direct_consolidation_id IS NULL AND v_matched_shipment_id IS NOT NULL THEN
    SELECT c.id
    INTO v_parent_consolidation_id
    FROM public.consolidations c
    JOIN public.consolidation_shipments cs ON cs.consolidation_id = c.id
    WHERE cs.shipment_id = v_matched_shipment_id
    ORDER BY cs.created_at DESC, COALESCE(c.updated_at, c.created_at) DESC, c.created_at DESC, c.id DESC
    LIMIT 1;

    IF v_parent_consolidation_id IS NULL THEN
      SELECT c.id
      INTO v_parent_consolidation_id
      FROM public.shipments s
      JOIN public.consolidations c
        ON lower(COALESCE(NULLIF(BTRIM(c.code), ''), '')) = lower(
          COALESCE(
            NULLIF(BTRIM((regexp_match(COALESCE(s.notes, ''), '(?i)Consolidation\s*:\s*([^|]+)'))[1]), ''),
            ''
          )
        )
      WHERE s.id = v_matched_shipment_id
      ORDER BY COALESCE(c.updated_at, c.created_at) DESC, c.created_at DESC, c.id DESC
      LIMIT 1;
    END IF;
  END IF;

  v_target_consolidation_id := COALESCE(v_direct_consolidation_id, v_parent_consolidation_id);

  IF v_target_consolidation_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'kind', 'consolidation',
      'id', c.id,
      'code', c.code,
      'status', public.normalize_consolidation_status_value(c.status),
      'tracking_number', COALESCE(
        NULLIF(BTRIM(c.tracking_code), ''),
        CASE WHEN summary.shipment_tracking_reference_count = 1 THEN summary.shipment_tracking_reference END,
        c.code
      ),
      'airway_bill_number', summary.airway_bill_number,
      'created_at', c.created_at,
      'pickup_date', summary.pickup_date,
      'estimated_delivery_date', summary.estimated_delivery_date,
      'actual_delivery_date', summary.actual_delivery_date,
      'origin', summary.origin,
      'destination', summary.destination,
      'weight', COALESCE(c.total_weight, summary.total_weight, 0),
      'cbm', COALESCE(c.total_cbm, summary.total_cbm, 0),
      'shipping_fee', COALESCE(c.total_cost, summary.total_shipping_fee, 0),
      'item_value', COALESCE(summary.total_item_value, 0),
      'item_count', COALESCE(c.item_count, summary.item_count, 0),
      'status_message', COALESCE(events.latest_message, 'No transit message available yet.'),
      'carrier_query', COALESCE(
        CASE WHEN summary.airway_bill_count = 1 THEN summary.airway_bill_number END,
        NULLIF(BTRIM(c.tracking_code), ''),
        CASE WHEN summary.shipment_tracking_reference_count = 1 THEN summary.shipment_tracking_reference END
      ),
      'shipsgo_transport', summary.shipsgo_transport,
      'events', COALESCE(events.event_rows, '[]'::jsonb),
      'items', COALESCE(summary.items, '[]'::jsonb)
    )
    INTO v_result
    FROM public.consolidations c
    CROSS JOIN LATERAL (
      SELECT
        COUNT(*)::integer AS item_count,
        MIN(s.pickup_date) AS pickup_date,
        MAX(s.estimated_delivery_date) AS estimated_delivery_date,
        MAX(s.actual_delivery_date) AS actual_delivery_date,
        MAX(COALESCE(ob.city, ob.name)) AS origin,
        MAX(COALESCE(db.city, db.name)) AS destination,
        COALESCE(SUM(COALESCE(s.weight, 0)), 0) AS total_weight,
        COALESCE(SUM(COALESCE(public.shipment_cbm_from_notes(s.notes), s.cbm, 0)), 0) AS total_cbm,
        COALESCE(SUM(COALESCE(s.total_cost, 0)), 0) AS total_item_value,
        COALESCE(SUM(COALESCE(s.shipping_cost, 0)), 0) AS total_shipping_fee,
        CASE
          WHEN COUNT(DISTINCT public.shipsgo_transport_from_service_type(s.service_type))
            FILTER (WHERE public.shipsgo_transport_from_service_type(s.service_type) IS NOT NULL) = 1
          THEN MAX(public.shipsgo_transport_from_service_type(s.service_type))
          ELSE NULL
        END AS shipsgo_transport,
        MIN(public.shipment_airway_bill_from_notes(s.notes))
          FILTER (WHERE public.shipment_airway_bill_from_notes(s.notes) IS NOT NULL) AS airway_bill_number,
        COUNT(DISTINCT public.shipment_airway_bill_from_notes(s.notes))
          FILTER (WHERE public.shipment_airway_bill_from_notes(s.notes) IS NOT NULL) AS airway_bill_count,
        MIN(COALESCE(NULLIF(BTRIM(s.custom_tracking_number), ''), NULLIF(BTRIM(s.code), '')))
          FILTER (
            WHERE COALESCE(NULLIF(BTRIM(s.custom_tracking_number), ''), NULLIF(BTRIM(s.code), '')) IS NOT NULL
          ) AS shipment_tracking_reference,
        COUNT(DISTINCT COALESCE(NULLIF(BTRIM(s.custom_tracking_number), ''), NULLIF(BTRIM(s.code), '')))
          FILTER (
            WHERE COALESCE(NULLIF(BTRIM(s.custom_tracking_number), ''), NULLIF(BTRIM(s.code), '')) IS NOT NULL
          ) AS shipment_tracking_reference_count,
        jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'code', s.code,
            'tracking_number', COALESCE(NULLIF(BTRIM(s.custom_tracking_number), ''), s.code),
            'airway_bill_number', public.shipment_airway_bill_from_notes(s.notes),
            'description', COALESCE(NULLIF(BTRIM(s.description), ''), s.code),
            'service_type', s.service_type,
            'quantity', COALESCE(s.quantity, 1),
            'weight', COALESCE(s.weight, 0),
            'cbm', COALESCE(public.shipment_cbm_from_notes(s.notes), s.cbm, 0),
            'item_value', COALESCE(s.total_cost, 0),
            'shipping_fee', COALESCE(s.shipping_cost, 0),
            'status', s.status
          )
          ORDER BY s.created_at, s.code
        ) AS items
      FROM public.consolidation_shipments cs
      JOIN public.shipments s ON s.id = cs.shipment_id
      LEFT JOIN public.branches ob ON ob.id = s.branch_id
      LEFT JOIN public.branches db ON db.id = s.destination_branch_id
      WHERE cs.consolidation_id = c.id
    ) summary
    CROSS JOIN LATERAL (
      WITH event_source AS (
        SELECT n.title, n.message, n.created_at
        FROM public.notifications n
        WHERE n.reference_id = c.id

        UNION ALL

        SELECT n.title, n.message, n.created_at
        FROM public.notifications n
        WHERE EXISTS (
          SELECT 1
          FROM public.consolidation_shipments cs2
          WHERE cs2.consolidation_id = c.id
            AND cs2.shipment_id = n.reference_id
        )
      )
      SELECT
        (
          jsonb_agg(
            jsonb_build_object(
              'title', event_source.title,
              'message', event_source.message,
              'created_at', event_source.created_at
            )
            ORDER BY event_source.created_at
          )
        ) AS event_rows,
        (
          ARRAY_AGG(event_source.message ORDER BY event_source.created_at DESC)
        )[1] AS latest_message
      FROM event_source
    ) events
    WHERE c.id = v_target_consolidation_id;

    IF v_result IS NOT NULL THEN
      RETURN v_result;
    END IF;
  END IF;

  IF v_matched_shipment_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'kind', 'shipment',
      'id', s.id,
      'code', s.code,
      'status', s.status,
      'tracking_number', COALESCE(NULLIF(BTRIM(s.custom_tracking_number), ''), s.code),
      'airway_bill_number', public.shipment_airway_bill_from_notes(s.notes),
      'created_at', s.created_at,
      'pickup_date', s.pickup_date,
      'estimated_delivery_date', s.estimated_delivery_date,
      'actual_delivery_date', s.actual_delivery_date,
      'origin', COALESCE(ob.city, ob.name),
      'destination', COALESCE(db.city, db.name),
      'weight', COALESCE(s.weight, 0),
      'cbm', COALESCE(public.shipment_cbm_from_notes(s.notes), s.cbm, 0),
      'shipping_fee', COALESCE(s.shipping_cost, 0),
      'item_value', COALESCE(s.total_cost, 0),
      'item_count', COALESCE(s.quantity, 1),
      'status_message', COALESCE(events.latest_message, 'No transit message available yet.'),
      'carrier_query', COALESCE(
        public.shipment_airway_bill_from_notes(s.notes),
        NULLIF(BTRIM(s.custom_tracking_number), ''),
        NULLIF(BTRIM(s.code), '')
      ),
      'shipsgo_transport', public.shipsgo_transport_from_service_type(s.service_type),
      'events', COALESCE(events.event_rows, '[]'::jsonb),
      'items', jsonb_build_array(
        jsonb_build_object(
          'id', s.id,
          'code', s.code,
          'tracking_number', COALESCE(NULLIF(BTRIM(s.custom_tracking_number), ''), s.code),
          'airway_bill_number', public.shipment_airway_bill_from_notes(s.notes),
          'description', COALESCE(NULLIF(BTRIM(s.description), ''), s.code),
          'service_type', s.service_type,
          'quantity', COALESCE(s.quantity, 1),
          'weight', COALESCE(s.weight, 0),
          'cbm', COALESCE(public.shipment_cbm_from_notes(s.notes), s.cbm, 0),
          'item_value', COALESCE(s.total_cost, 0),
          'shipping_fee', COALESCE(s.shipping_cost, 0),
          'status', s.status
        )
      )
    )
    INTO v_result
    FROM public.shipments s
    LEFT JOIN public.branches ob ON ob.id = s.branch_id
    LEFT JOIN public.branches db ON db.id = s.destination_branch_id
    CROSS JOIN LATERAL (
      SELECT
        (
          jsonb_agg(
            jsonb_build_object(
              'title', n.title,
              'message', n.message,
              'created_at', n.created_at
            )
            ORDER BY n.created_at
          )
        ) AS event_rows,
        (
          ARRAY_AGG(n.message ORDER BY n.created_at DESC)
        )[1] AS latest_message
      FROM public.notifications n
      WHERE n.reference_id = s.id
    ) events
    WHERE s.id = v_matched_shipment_id;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_shipment_details_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.track_shipment_details_by_code(text) TO authenticated;

COMMIT;
