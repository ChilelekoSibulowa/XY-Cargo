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
  v_shipment_id uuid;
  v_matching_shipment_ids uuid[] := ARRAY[]::uuid[];
  v_consolidation_id uuid;
BEGIN
  IF v_lookup IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    -- 1. Look for direct shipment matches (can be multiple)
    SELECT COALESCE(
      array_agg(s.id ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.created_at DESC, s.id DESC),
      ARRAY[]::uuid[]
    )
    INTO v_matching_shipment_ids
    FROM public.shipments s
    WHERE public.tracking_lookup_matches(s.code, v_lookup)
       OR public.tracking_lookup_matches(s.custom_tracking_number, v_lookup)
       OR public.tracking_lookup_matches(s.awb_number, v_lookup)
       OR public.tracking_lookup_matches(s.bl_number, v_lookup)
       OR public.tracking_lookup_matches(public.shipment_warehouse_tracking_from_notes(s.notes), v_lookup)
       OR public.tracking_lookup_matches(public.shipment_airway_bill_from_notes(s.notes), v_lookup);

    v_shipment_id := v_matching_shipment_ids[1];

    -- If multiple shipments found, treat as an ad-hoc consolidation
    IF COALESCE(array_length(v_matching_shipment_ids, 1), 0) > 1 THEN
      SELECT jsonb_build_object(
        'kind', 'consolidation',
        'id', summary.first_shipment_id,
        'code', v_lookup,
        'status', summary.latest_status,
        'tracking_number', COALESCE(
          summary.shipment_tracking_reference,
          summary.shipment_code_reference
        ),
        'airway_bill_number', summary.airway_bill_number,
        'created_at', summary.created_at,
        'pickup_date', summary.pickup_date,
        'estimated_delivery_date', summary.estimated_delivery_date,
        'actual_delivery_date', summary.actual_delivery_date,
        'origin', summary.origin,
        'destination', summary.destination,
        'weight', COALESCE(summary.total_weight, 0),
        'cbm', COALESCE(summary.total_cbm, 0),
        'shipping_fee', COALESCE(summary.total_shipping_fee, 0),
        'item_value', COALESCE(summary.total_item_value, 0),
        'item_count', COALESCE(summary.item_count, 0),
        'status_message', COALESCE(events.latest_message, 'Tracking details loaded.'),
        'carrier_query', COALESCE(
          summary.airway_bill_number,
          summary.shipment_tracking_reference,
          summary.shipment_code_reference
        ),
        'shipsgo_transport', summary.shipsgo_transport,
        'events', COALESCE(events.event_rows, '[]'::jsonb),
        'items', jsonb_build_array(
          jsonb_build_object(
            'id', 'consolidation-' || summary.first_shipment_id::text,
            'code', v_lookup,
            'tracking_number', COALESCE(
              summary.shipment_tracking_reference,
              summary.shipment_code_reference
            ),
            'airway_bill_number', summary.airway_bill_number,
            'description', 'Consolidated shipment (' || COALESCE(summary.item_count, 0)::text || ' items)',
            'service_type', COALESCE(summary.shipsgo_transport, 'mixed'),
            'quantity', COALESCE(summary.total_quantity, 1),
            'weight', COALESCE(summary.total_weight, 0),
            'cbm', COALESCE(summary.total_cbm, 0),
            'item_value', COALESCE(summary.total_item_value, 0),
            'shipping_fee', COALESCE(summary.total_shipping_fee, 0),
            'status', summary.latest_status
          )
        )
      )
      INTO v_result
      FROM (
        SELECT
          (ARRAY_AGG(s.id ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.created_at DESC, s.id DESC))[1] AS first_shipment_id,
          (ARRAY_AGG(s.status ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.created_at DESC, s.id DESC))[1] AS latest_status,
          COUNT(*)::integer AS item_count,
          MIN(s.created_at) AS created_at,
          MIN(s.pickup_date) AS pickup_date,
          MAX(s.estimated_delivery_date) AS estimated_delivery_date,
          MAX(s.actual_delivery_date) AS actual_delivery_date,
          MAX(COALESCE(ob.city, ob.name)) AS origin,
          MAX(COALESCE(db.city, db.name)) AS destination,
          COALESCE(SUM(COALESCE(s.quantity, 1)), 0) AS total_quantity,
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
          MIN(COALESCE(
            NULLIF(BTRIM(s.awb_number), ''),
            NULLIF(BTRIM(s.bl_number), ''),
            public.shipment_airway_bill_from_notes(s.notes)
          )) FILTER (WHERE COALESCE(
            NULLIF(BTRIM(s.awb_number), ''),
            NULLIF(BTRIM(s.bl_number), ''),
            public.shipment_airway_bill_from_notes(s.notes)
          ) IS NOT NULL) AS airway_bill_number,
          COUNT(DISTINCT COALESCE(
            NULLIF(BTRIM(s.awb_number), ''),
            NULLIF(BTRIM(s.bl_number), ''),
            public.shipment_airway_bill_from_notes(s.notes)
          )) FILTER (WHERE COALESCE(
            NULLIF(BTRIM(s.awb_number), ''),
            NULLIF(BTRIM(s.bl_number), ''),
            public.shipment_airway_bill_from_notes(s.notes)
          ) IS NOT NULL) AS airway_bill_count,
          MIN(public.shipment_warehouse_tracking_from_notes(s.notes)) 
          FILTER (WHERE public.shipment_warehouse_tracking_from_notes(s.notes) IS NOT NULL) AS shipment_tracking_reference,
          MIN(NULLIF(BTRIM(s.code), '')) AS shipment_code_reference,
          COUNT(DISTINCT public.shipment_warehouse_tracking_from_notes(s.notes)) 
          FILTER (WHERE public.shipment_warehouse_tracking_from_notes(s.notes) IS NOT NULL) AS shipment_tracking_reference_count
        FROM public.shipments s
        LEFT JOIN public.branches ob ON ob.id = s.branch_id
        LEFT JOIN public.branches db ON db.id = s.destination_branch_id
        WHERE s.id = ANY(v_matching_shipment_ids)
      ) summary
      CROSS JOIN LATERAL (
        SELECT
          jsonb_agg(
            jsonb_build_object(
              'title', n.title,
              'message', n.message,
              'created_at', n.created_at
            )
            ORDER BY n.created_at
          ) AS event_rows,
          (ARRAY_AGG(n.message ORDER BY n.created_at DESC))[1] AS latest_message
        FROM public.notifications n
        WHERE n.reference_id = ANY(v_matching_shipment_ids)
      ) events;

      IF v_result IS NOT NULL THEN
        RETURN v_result;
      END IF;
    END IF;

    -- 2. Single direct shipment match
    IF v_shipment_id IS NOT NULL THEN
      SELECT jsonb_build_object(
        'kind', 'shipment',
        'id', s.id,
        'code', s.code,
        'status', s.status,
        'tracking_number', COALESCE(
          public.shipment_warehouse_tracking_from_notes(s.notes),
          s.code
        ),
        'airway_bill_number', COALESCE(
          NULLIF(BTRIM(s.awb_number), ''),
          NULLIF(BTRIM(s.bl_number), ''),
          public.shipment_airway_bill_from_notes(s.notes)
        ),
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
        'status_message', COALESCE(events.latest_message, 'Tracking details loaded.'),
        'carrier_query', COALESCE(
          NULLIF(BTRIM(s.awb_number), ''),
          NULLIF(BTRIM(s.bl_number), ''),
          public.shipment_airway_bill_from_notes(s.notes),
          public.shipment_warehouse_tracking_from_notes(s.notes),
          NULLIF(BTRIM(s.code), '')
        ),
        'shipsgo_transport', public.shipsgo_transport_from_service_type(s.service_type),
        'events', COALESCE(events.event_rows, '[]'::jsonb),
        'items', jsonb_build_array(
          jsonb_build_object(
            'id', s.id,
            'code', s.code,
            'tracking_number', COALESCE(
              public.shipment_warehouse_tracking_from_notes(s.notes),
              s.code
            ),
            'airway_bill_number', COALESCE(
              NULLIF(BTRIM(s.awb_number), ''),
              NULLIF(BTRIM(s.bl_number), ''),
              public.shipment_airway_bill_from_notes(s.notes)
            ),
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
          jsonb_agg(
            jsonb_build_object(
              'title', n.title,
              'message', n.message,
              'created_at', n.created_at
            )
            ORDER BY n.created_at
          ) AS event_rows,
          (ARRAY_AGG(n.message ORDER BY n.created_at DESC))[1] AS latest_message
        FROM public.notifications n
        WHERE n.reference_id = s.id
      ) events
      WHERE s.id = v_shipment_id;

      IF v_result IS NOT NULL THEN
        RETURN v_result;
      END IF;
    END IF;

    -- 3. Match by consolidation code
    SELECT c.id
    INTO v_consolidation_id
    FROM public.consolidations c
    WHERE public.tracking_lookup_matches(c.code, v_lookup)
       OR public.tracking_lookup_matches(c.tracking_code, v_lookup)
       OR public.tracking_lookup_matches(public.shipment_warehouse_tracking_from_notes(c.notes), v_lookup)
       OR EXISTS (
         SELECT 1
         FROM public.consolidation_shipments cs
         JOIN public.shipments s ON s.id = cs.shipment_id
         WHERE cs.consolidation_id = c.id
           AND (
             public.tracking_lookup_matches(s.code, v_lookup)
             OR public.tracking_lookup_matches(s.custom_tracking_number, v_lookup)
             OR public.tracking_lookup_matches(s.awb_number, v_lookup)
             OR public.tracking_lookup_matches(s.bl_number, v_lookup)
             OR public.tracking_lookup_matches(public.shipment_warehouse_tracking_from_notes(s.notes), v_lookup)
             OR public.tracking_lookup_matches(public.shipment_airway_bill_from_notes(s.notes), v_lookup)
           )
       )
    ORDER BY COALESCE(c.updated_at, c.created_at) DESC, c.created_at DESC, c.id DESC
    LIMIT 1;

    IF v_consolidation_id IS NULL THEN
      RETURN NULL;
    END IF;

    SELECT jsonb_build_object(
      'kind', 'consolidation',
      'id', c.id,
      'code', c.code,
      'status', public.normalize_consolidation_status_value(c.status),
      'tracking_number', COALESCE(
        public.shipment_warehouse_tracking_from_notes(c.notes),
        NULLIF(BTRIM(c.tracking_code), ''),
        summary.shipment_tracking_reference,
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
      'status_message', COALESCE(events.latest_message, 'Tracking details loaded.'),
      'carrier_query', COALESCE(
        summary.airway_bill_number,
        public.shipment_warehouse_tracking_from_notes(c.notes),
        NULLIF(BTRIM(c.tracking_code), ''),
        summary.shipment_tracking_reference,
        NULLIF(BTRIM(c.code), '')
      ),
      'shipsgo_transport', summary.shipsgo_transport,
      'events', COALESCE(events.event_rows, '[]'::jsonb),
      'items', jsonb_build_array(
        jsonb_build_object(
          'id', 'consolidation-' || c.id::text,
          'code', c.code,
          'tracking_number', COALESCE(
            public.shipment_warehouse_tracking_from_notes(c.notes),
            NULLIF(BTRIM(c.tracking_code), ''),
            summary.shipment_tracking_reference,
            c.code
          ),
          'airway_bill_number', summary.airway_bill_number,
          'description', 'Consolidated shipment (' || COALESCE(c.item_count, summary.item_count, 0)::text || ' items)',
          'service_type', COALESCE(summary.shipsgo_transport, 'mixed'),
          'quantity', summary.total_quantity,
          'weight', COALESCE(c.total_weight, summary.total_weight, 0),
          'cbm', COALESCE(c.total_cbm, summary.total_cbm, 0),
          'item_value', COALESCE(summary.total_item_value, 0),
          'shipping_fee', COALESCE(c.total_cost, summary.total_shipping_fee, 0),
          'status', public.normalize_consolidation_status_value(c.status)
        )
      )
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
        COALESCE(SUM(COALESCE(s.quantity, 1)), 0) AS total_quantity,
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
        MIN(COALESCE(
          NULLIF(BTRIM(s.awb_number), ''),
          NULLIF(BTRIM(s.bl_number), ''),
          public.shipment_airway_bill_from_notes(s.notes)
        )) FILTER (WHERE COALESCE(
          NULLIF(BTRIM(s.awb_number), ''),
          NULLIF(BTRIM(s.bl_number), ''),
          public.shipment_airway_bill_from_notes(s.notes)
        ) IS NOT NULL) AS airway_bill_number,
        MIN(public.shipment_warehouse_tracking_from_notes(s.notes)) 
        FILTER (WHERE public.shipment_warehouse_tracking_from_notes(s.notes) IS NOT NULL) AS shipment_tracking_reference
      FROM public.consolidation_shipments cs
      JOIN public.shipments s ON s.id = cs.shipment_id
      LEFT JOIN public.branches ob ON ob.id = s.branch_id
      LEFT JOIN public.branches db ON db.id = s.destination_branch_id
      WHERE cs.consolidation_id = c.id
    ) summary
    CROSS JOIN LATERAL (
      SELECT
        jsonb_agg(
          jsonb_build_object(
            'title', n.title,
            'message', n.message,
            'created_at', n.created_at
          )
          ORDER BY n.created_at
        ) AS event_rows,
        (ARRAY_AGG(n.message ORDER BY n.created_at DESC))[1] AS latest_message
      FROM (
        SELECT reference_id FROM public.consolidation_shipments WHERE consolidation_id = c.id
        UNION
        SELECT c.id
      ) refs
      JOIN public.notifications n ON n.reference_id = refs.reference_id
    ) events
    WHERE c.id = v_consolidation_id;

    RETURN v_result;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$;
