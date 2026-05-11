import { supabase } from "@/integrations/supabase/client";
import { getWarehouseTrackingNumber, resolveTrackingByStatus } from "@/lib/shipmentNotes";

type NotificationsErrorLike = {
  code?: string;
  message?: string;
};

export const isNotificationsUnavailableError = (error: NotificationsErrorLike | null | undefined) => {
  if (!error) return false;

  const code = error.code || "";
  const message = (error.message || "").toLowerCase();

  return (
    code === "42501" ||
    code === "42P01" ||
    code === "42703" ||
    message.includes("permission") ||
    message.includes("row-level security") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
};

type NotificationTrackingRow = {
  title: string;
  message: string;
  reference_id?: string | null;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const CODE_IN_TEXT_PATTERN = /\b(?:SHP|CON|CNS)-[A-Z0-9-]+\b/gi;

const resolveTrackingValue = (
  status: string | null,
  notes: string | null,
  fallback: string | null | undefined,
) => {
  return resolveTrackingByStatus(status, notes, fallback);
};

export const remapNotificationsToWarehouseTracking = async <T extends NotificationTrackingRow>(
  notifications: T[],
): Promise<T[]> => {
  if (notifications.length === 0) return notifications;

  const referenceIds = Array.from(
    new Set(
      notifications
        .map((row) => row.reference_id)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ),
  );

  const codesFromText = new Set<string>();
  notifications.forEach((row) => {
    const combined = `${row.title} ${row.message}`;
    const matches = combined.match(CODE_IN_TEXT_PATTERN) || [];
    matches.forEach((code) => codesFromText.add(code.toUpperCase()));
  });

  const [shipmentsByRefRes, consolidationsByRefRes, shipmentsByCodeRes, consolidationsByCodeRes] =
    await Promise.all([
      referenceIds.length > 0
        ? supabase
          .from("shipments")
          .select("id, code, notes, custom_tracking_number, status")
          .in("id", referenceIds)
        : Promise.resolve({ data: [], error: null }),
      referenceIds.length > 0
        ? supabase
          .from("consolidations")
          .select("id, code, notes, tracking_code, status")
          .in("id", referenceIds)
        : Promise.resolve({ data: [], error: null }),
      codesFromText.size > 0
        ? supabase
          .from("shipments")
          .select("code, notes, custom_tracking_number, status")
          .in("code", Array.from(codesFromText))
        : Promise.resolve({ data: [], error: null }),
      codesFromText.size > 0
        ? supabase
          .from("consolidations")
          .select("code, notes, tracking_code, status")
          .in("code", Array.from(codesFromText))
        : Promise.resolve({ data: [], error: null }),
    ]);

  const trackingByReferenceId = new Map<string, { code: string; tracking: string }>();
  const trackingByCode = new Map<string, string>();

  ((shipmentsByRefRes.data || []) as Array<{
    id: string;
    code: string;
    notes: string | null;
    custom_tracking_number: string | null;
    status: string | null;
  }>).forEach((row) => {
    const tracking = resolveTrackingValue(row.status, row.notes, row.custom_tracking_number);
    if (!tracking) return;
    trackingByReferenceId.set(row.id, { code: row.code, tracking });
    trackingByCode.set(row.code.toUpperCase(), tracking);
  });

  ((consolidationsByRefRes.data || []) as Array<{
    id: string;
    code: string;
    notes: string | null;
    tracking_code: string | null;
    status: string | null;
  }>).forEach((row) => {
    const tracking = resolveTrackingValue(row.status, row.notes, row.tracking_code);
    if (!tracking) return;
    trackingByReferenceId.set(row.id, { code: row.code, tracking });
    trackingByCode.set(row.code.toUpperCase(), tracking);
  });

  ((shipmentsByCodeRes.data || []) as Array<{
    code: string;
    notes: string | null;
    custom_tracking_number: string | null;
    status: string | null;
  }>).forEach((row) => {
    const tracking = resolveTrackingValue(row.status, row.notes, row.custom_tracking_number);
    if (!tracking) return;
    trackingByCode.set(row.code.toUpperCase(), tracking);
  });

  ((consolidationsByCodeRes.data || []) as Array<{
    code: string;
    notes: string | null;
    tracking_code: string | null;
    status: string | null;
  }>).forEach((row) => {
    const tracking = resolveTrackingValue(row.status, row.notes, row.tracking_code);
    if (!tracking) return;
    trackingByCode.set(row.code.toUpperCase(), tracking);
  });

  const replaceCodes = (value: string) =>
    value.replace(CODE_IN_TEXT_PATTERN, (code) => trackingByCode.get(code.toUpperCase()) || code);

  return notifications.map((row) => {
    const mappedRef = row.reference_id ? trackingByReferenceId.get(row.reference_id) : undefined;

    let title = replaceCodes(row.title || "");
    let message = replaceCodes(row.message || "");

    if (mappedRef?.code && mappedRef.tracking) {
      // Simple replacement of shipment code with tracking number if present
      // We no longer inject "Parcel [tracking]" or "Shipment [tracking]" aggressively
      // to avoid duplicating the tracking number if it's already in the message.
      const codePattern = new RegExp(escapeRegExp(mappedRef.code), "g");
      title = title.replace(codePattern, mappedRef.tracking);
      message = message.replace(codePattern, mappedRef.tracking);
    }

    return {
      ...row,
      title,
      message,
    };
  });
};

interface SendNotificationParams {
  customer_id?: string;
  user_id?: string;
  event_type: string;
  title: string;
  message: string;
  sms_message?: string;
  email_subject?: string;
  email_body?: string;
  reference_id?: string;
  notification_type?: string;
  channels?: ("sms" | "email" | "bell")[];
}

/**
 * Fire-and-forget notification helper.
 * Sends SMS (Zamtel), Email (Resend), and in-app bell notification
 * via the send-notification edge function.
 */
export const sendNotification = async (params: SendNotificationParams) => {
  try {
    await supabase.functions.invoke("send-notification", {
      body: {
        ...params,
        channels: params.channels ?? ["bell", "sms", "email"],
      },
    });
  } catch (err) {
    console.error("sendNotification failed:", err);
  }
};

export const notifyShipmentCreated = async (
  options: {
    customerId?: string;
    userId?: string;
    shipmentCode: string;
    shipmentId: string;
    creator: "customer" | "agent";
  },
) => {
  const tracking = options.shipmentCode?.trim();
  const trackingText = tracking ? `with tracking number ${tracking} ` : "";

  let customerName = "Valued Customer";
  if (options.customerId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("full_name")
      .eq("id", options.customerId)
      .maybeSingle();
    if (customer?.full_name) customerName = customer.full_name;
  }

  const title = "Parcel Created";
  const message = `Dear ${customerName}, your parcel ${trackingText}has been successfully created.`;
  const sms = `Dear ${customerName}, your parcel ${trackingText}has been successfully created.`;

  // Always notify the customer when a parcel is created (regardless of who created it)
  if (options.customerId) {
    return sendNotification({
      customer_id: options.customerId,
      event_type: "shipment_created",
      title,
      message,
      sms_message: sms,
      reference_id: options.shipmentId,
      notification_type: "shipment",
    });
  }

  // Fallback: notify by user_id when no customerId is available
  if (options.userId) {
    return sendNotification({
      user_id: options.userId,
      event_type: "shipment_created",
      title,
      message,
      sms_message: sms,
      reference_id: options.shipmentId,
      notification_type: "shipment",
    });
  }

  return undefined;
};

// Pre-defined notification templates
export const notifyWelcome = (customerId: string, customerName: string) =>
  sendNotification({
    customer_id: customerId,
    event_type: "account_created",
    title: "Welcome to XY Cargo Zambia!",
    message: `Dear ${customerName}, thank you for registering with XY Cargo Zambia. We're excited to have you on board!`,
    sms_message: `Dear ${customerName}, thank you for registering with XY Cargo Zambia. We're excited to have you on board!`,
    notification_type: "account",
  });

export const notifyStatusChange = async (
  customerId: string,
  shipmentTrackingNumber: string | null | undefined,
  shipmentId: string,
  newStatus: string,
  options?: { handlingMethod?: "single" | "consolidated" | string | null },
) => {
  const tracking = (shipmentTrackingNumber || "").trim();
  const hasTracking = tracking && tracking !== "Pending";
  const trackingText = hasTracking ? `with tracking number ${tracking} ` : "";
  const handling = (options?.handlingMethod || "").toLowerCase();
  const isSingle = handling === "single" || handling === "";

  let customerName = "Valued Customer";
  const { data: customer } = await supabase
    .from("customers")
    .select("full_name")
    .eq("id", customerId)
    .maybeSingle();
  if (customer?.full_name) customerName = customer.full_name;

  const receivedMessage = isSingle
    ? `Dear ${customerName}, your parcel ${trackingText}has arrived at the origin warehouse and is awaiting your action.`
    : `Dear ${customerName}, your parcel ${trackingText}has arrived at the origin warehouse. Kindly log in and consolidate your items.`;

  const submittedMessage = isSingle
    ? `Dear ${customerName}, your parcel ${trackingText}has arrived at the origin warehouse and is awaiting your action.`
    : `Dear ${customerName}, your parcels have been consolidated successfully.`;

  const statusMessages: Record<string, { title: string; message: string; sms: string }> = {
    saved_dropoff: {
      title: "Parcel Incoming",
      message: `Dear ${customerName}, your parcel ${trackingText}is on the way to the origin warehouse.`,
      sms: `Dear ${customerName}, your parcel ${trackingText}is on the way to the origin warehouse.`,
    },
    received: {
      title: isSingle ? "Parcel Arrived" : "Need Action",
      message: receivedMessage,
      sms: receivedMessage,
    },
    requested_pickup: {
      title: "Shipment Submitted",
      message: submittedMessage,
      sms: submittedMessage,
    },
    approved: {
      title: "Confirm Shipment",
      message: `Dear ${customerName}, your shipment is awaiting confirmation. Kindly log in and confirm your shipment.`,
      sms: `Dear ${customerName}, your shipment is awaiting confirmation. Kindly log in and confirm your shipment.`,
    },
    assigned: {
      title: "Shipment Confirmed",
      message: `Dear ${customerName}, your shipment has been confirmed successfully.`,
      sms: `Dear ${customerName}, your shipment has been confirmed successfully.`,
    },
    supplied: {
      title: "Shipment In Transit",
      message: `Dear ${customerName}, your shipment with tracking number ${tracking} is now in transit.`,
      sms: `Dear ${customerName}, your shipment with tracking number ${tracking} is now in transit.`,
    },
    delivered: {
      title: "Ready for Collection",
      message: `Dear ${customerName}, your shipment with tracking number ${tracking} has arrived at the destination warehouse and is awaiting collection.`,
      sms: `Dear ${customerName}, your shipment with tracking number ${tracking} has arrived at the destination warehouse and is awaiting collection.`,
    },
    arrived: {
      title: "Ready for Collection",
      message: `Dear ${customerName}, your shipment with tracking number ${tracking} has arrived at the destination warehouse and is awaiting collection.`,
      sms: `Dear ${customerName}, your shipment with tracking number ${tracking} has arrived at the destination warehouse and is awaiting collection.`,
    },
    closed: {
      title: "Shipment Collected",
      message: `Dear ${customerName}, your shipment with tracking number ${tracking} has been collected successfully.`,
      sms: `Dear ${customerName}, your shipment with tracking number ${tracking} has been collected successfully.`,
    },
    need_action: {
      title: "Need Action",
      message: `Dear ${customerName}, your parcel ${trackingText}has arrived at the origin warehouse. Kindly log in and consolidate your items.`,
      sms: `Dear ${customerName}, your parcel ${trackingText}has arrived at the origin warehouse. Kindly log in and consolidate your items.`,
    }
  };

  const template = statusMessages[newStatus];
  if (!template) return;

  return sendNotification({
    customer_id: customerId,
    event_type: `shipment_${newStatus}`,
    title: template.title,
    message: template.message,
    sms_message: template.sms,
    reference_id: shipmentId,
    notification_type: "shipment",
  });
};

export const notifyShipmentUpdated = async (
  customerId: string,
  shipmentId: string,
) => {
  let customerName = "Valued Customer";
  const { data: customer } = await supabase
    .from("customers")
    .select("full_name")
    .eq("id", customerId)
    .maybeSingle();
  if (customer?.full_name) customerName = customer.full_name;

  return sendNotification({
    customer_id: customerId,
    event_type: "shipment_updated",
    title: "Shipment Updated",
    message: `Dear ${customerName}, there has been an update with your shipment. Please log in to check the details.`,
    sms_message: `Dear ${customerName}, there has been an update with your shipment. Please log in to check the details.`,
    reference_id: shipmentId,
    notification_type: "shipment",
  });
};

export const notifyConsolidation = async (customerId: string, consolidationCode: string, consolidationId: string) => {
  let customerName = "Valued Customer";
  const { data: customer } = await supabase
    .from("customers")
    .select("full_name")
    .eq("id", customerId)
    .maybeSingle();
  if (customer?.full_name) customerName = customer.full_name;

  return sendNotification({
    customer_id: customerId,
    event_type: "consolidation_created",
    title: "Consolidation Successful",
    message: `Dear ${customerName}, your parcels have been consolidated successfully.`,
    sms_message: `Dear ${customerName}, your parcels have been consolidated successfully.`,
    reference_id: consolidationId,
    notification_type: "shipment",
  });
};

export const notifyPaymentReceived = async (
  customerId: string,
  amount: string,
  shipmentTrackingNumber?: string | null,
) => {
  let customerName = "Valued Customer";
  const { data: customer } = await supabase
    .from("customers")
    .select("full_name")
    .eq("id", customerId)
    .maybeSingle();
  if (customer?.full_name) customerName = customer.full_name;

  return sendNotification({
    customer_id: customerId,
    event_type: "payment_received",
    title: "Payment Received",
    message: `Dear ${customerName}, your payment has been received successfully.`,
    sms_message: `Dear ${customerName}, your payment has been received successfully.`,
    notification_type: "payment",
  });
};

export const notifyBulkTransitUpdate = async (
  customerId: string,
  shipmentTrackingNumber: string | null | undefined,
  shipmentId: string,
  updateMessage: string,
) => {
  let customerName = "Valued Customer";
  const { data: customer } = await supabase
    .from("customers")
    .select("full_name")
    .eq("id", customerId)
    .maybeSingle();
  if (customer?.full_name) customerName = customer.full_name;

  const tracking = (shipmentTrackingNumber || "").trim();
  const trackingInfo = tracking ? ` for ${tracking}` : "";

  return sendNotification({
    customer_id: customerId,
    event_type: "transit_update",
    title: "Shipment Update",
    message: `Dear ${customerName}, update${trackingInfo}: ${updateMessage}`,
    sms_message: `Dear ${customerName}, update${trackingInfo}: ${updateMessage}`,
    reference_id: shipmentId,
    notification_type: "shipment",
  });
};

export const notifyDeliveryUpdate = async (
  customerId: string,
  shipmentTrackingNumber: string | null | undefined,
  shipmentId: string,
  deliveryStatus: string,
) => {
  let customerName = "Valued Customer";
  const { data: customer } = await supabase
    .from("customers")
    .select("full_name")
    .eq("id", customerId)
    .maybeSingle();
  if (customer?.full_name) customerName = customer.full_name;

  const tracking = (shipmentTrackingNumber || "").trim();

  const deliveryMessages: Record<string, { title: string; message: string; sms: string }> = {
    requested: {
      title: "Delivery Requested",
      message: `Dear ${customerName}, your delivery request for shipment tracking number ${tracking} has been processed successfully.`,
      sms: `Dear ${customerName}, your delivery request for shipment tracking number ${tracking} has been processed successfully.`,
    },
    assigned: {
      title: "On the way",
      message: `Dear ${customerName}, your shipment is on the way to your destination.`,
      sms: `Dear ${customerName}, your shipment is on the way to your destination.`,
    },
    successful: {
      title: "Delivery Successful",
      message: `Dear ${customerName}, your shipment has been delivered successfully.`,
      sms: `Dear ${customerName}, your shipment has been delivered successfully.`,
    },
    failed: {
      title: "Delivery Failed",
      message: `Dear ${customerName}, the delivery attempt for your shipment has failed.`,
      sms: `Dear ${customerName}, the delivery attempt for your shipment has failed.`,
    },
  };

  const template = deliveryMessages[deliveryStatus];
  if (!template) return;

  return sendNotification({
    customer_id: customerId,
    event_type: `delivery_${deliveryStatus}`,
    title: template.title,
    message: template.message,
    sms_message: template.sms,
    reference_id: shipmentId,
    notification_type: "shipment",
  });
};

export const notifyTrackingNumberAdded = async (
  customerId: string,
  trackingNumber: string,
  shipmentId: string,
) => {
  let customerName = "Valued Customer";
  const { data: customer } = await supabase
    .from("customers")
    .select("full_name")
    .eq("id", customerId)
    .maybeSingle();
  if (customer?.full_name) customerName = customer.full_name;

  return sendNotification({
    customer_id: customerId,
    event_type: "tracking_number_added",
    title: "Tracking Assigned",
    message: `Dear ${customerName}, the warehouse has assigned tracking number ${trackingNumber} to your shipment. Kindly log in to track your shipment.`,
    sms_message: `Dear ${customerName}, the warehouse has assigned tracking number ${trackingNumber} to your shipment. Kindly log in to track your shipment.`,
    reference_id: shipmentId,
    notification_type: "shipment",
  });
};

const notifyAgentForCustomer = async (
  customerId: string,
  title: string,
  message: string,
  referenceId?: string,
  notificationType: string = "shipment",
) => {
  const { data: customer } = await supabase
    .from("customers")
    .select("agent_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer?.agent_id) return;

  return sendNotification({
    user_id: customer.agent_id,
    event_type: notificationType,
    title,
    message,
    sms_message: message,
    reference_id: referenceId,
    notification_type: notificationType,
  });
};

export const notifyInvoiceIssued = async (
  customerId: string,
  invoiceCode: string,
  amount: string,
  invoiceId: string,
  trackingNumber?: string | null,
) => {
  let customerName = "Valued Customer";
  const { data: customer } = await supabase
    .from("customers")
    .select("full_name")
    .eq("id", customerId)
    .maybeSingle();
  if (customer?.full_name) customerName = customer.full_name;

  await sendNotification({
    customer_id: customerId,
    event_type: "invoice_issued",
    title: "Invoice Sent",
    message: `Dear ${customerName}, an invoice (${invoiceCode}) for ${amount} has been sent to you and is awaiting payment.`,
    sms_message: `Dear ${customerName}, an invoice (${invoiceCode}) for ${amount} has been sent to you and is awaiting payment.`,
    reference_id: invoiceId,
    notification_type: "payment",
  });

  await notifyAgentForCustomer(
    customerId,
    "Invoice Sent",
    `Invoice ${invoiceCode} for ${amount} has been sent to ${customerName} and is awaiting payment.`,
    invoiceId,
    "payment",
  );
};

export const notifyInvoicePaid = async (
  customerId: string,
  invoiceCode: string,
  amount: string,
  invoiceId: string,
) => {
  let customerName = "Valued Customer";
  const { data: customer } = await supabase
    .from("customers")
    .select("full_name")
    .eq("id", customerId)
    .maybeSingle();
  if (customer?.full_name) customerName = customer.full_name;

  await sendNotification({
    customer_id: customerId,
    event_type: "invoice_paid",
    title: "Invoice Paid",
    message: `Dear ${customerName}, your invoice ${invoiceCode} (${amount}) has been paid in full. Thank you!`,
    sms_message: `Dear ${customerName}, your invoice ${invoiceCode} (${amount}) has been paid in full. Thank you!`,
    reference_id: invoiceId,
    notification_type: "payment",
  });

  await notifyAgentForCustomer(
    customerId,
    "Invoice Paid",
    `Invoice ${invoiceCode} (${amount}) for ${customerName} has been paid in full.`,
    invoiceId,
    "payment",
  );
};

export const notifyDeliveryRequested = async (
  customerId: string,
  trackingNumber: string | null | undefined,
  shipmentId: string,
) => {
  let customerName = "Valued Customer";
  const { data: customer } = await supabase
    .from("customers")
    .select("full_name")
    .eq("id", customerId)
    .maybeSingle();
  if (customer?.full_name) customerName = customer.full_name;

  const tracking = (trackingNumber || "").trim();
  const trackingText = tracking ? ` for ${tracking}` : "";

  await sendNotification({
    customer_id: customerId,
    event_type: "delivery_requested",
    title: "Delivery Requested",
    message: `Dear ${customerName}, your delivery request${trackingText} has been received and is awaiting driver assignment.`,
    sms_message: `Dear ${customerName}, your delivery request${trackingText} has been received and is awaiting driver assignment.`,
    reference_id: shipmentId,
    notification_type: "shipment",
  });

  await notifyAgentForCustomer(
    customerId,
    "Delivery Requested",
    `${customerName} has requested delivery${trackingText}.`,
    shipmentId,
  );
};

export const notifyDriverAssigned = async (
  customerId: string,
  trackingNumber: string | null | undefined,
  shipmentId: string,
  driverName?: string | null,
) => {
  let customerName = "Valued Customer";
  const { data: customer } = await supabase
    .from("customers")
    .select("full_name")
    .eq("id", customerId)
    .maybeSingle();
  if (customer?.full_name) customerName = customer.full_name;

  const tracking = (trackingNumber || "").trim();
  const trackingText = tracking ? ` for ${tracking}` : "";
  const driverText = driverName ? ` Driver ${driverName} is on the way.` : " Your driver is on the way.";

  return sendNotification({
    customer_id: customerId,
    event_type: "delivery_assigned",
    title: "Driver Assigned",
    message: `Dear ${customerName}, a driver has been assigned to deliver your shipment${trackingText}.${driverText}`,
    sms_message: `Dear ${customerName}, a driver has been assigned to deliver your shipment${trackingText}.${driverText}`,
    reference_id: shipmentId,
    notification_type: "shipment",
  });
};

export const notifyParcelDelivered = async (
  customerId: string,
  trackingNumber: string | null | undefined,
  shipmentId: string,
  outcome: "successful" | "failed",
) => {
  let customerName = "Valued Customer";
  const { data: customer } = await supabase
    .from("customers")
    .select("full_name")
    .eq("id", customerId)
    .maybeSingle();
  if (customer?.full_name) customerName = customer.full_name;

  const tracking = (trackingNumber || "").trim();
  const trackingText = tracking ? ` (${tracking})` : "";

  const message = outcome === "successful"
    ? `Dear ${customerName}, your shipment${trackingText} has been delivered successfully. Thank you for choosing XY Cargo Zambia.`
    : `Dear ${customerName}, the delivery attempt for your shipment${trackingText} was unsuccessful. Our team will be in touch.`;

  await sendNotification({
    customer_id: customerId,
    event_type: outcome === "successful" ? "parcel_delivered" : "delivery_failed",
    title: outcome === "successful" ? "Delivered" : "Delivery Failed",
    message,
    sms_message: message,
    reference_id: shipmentId,
    notification_type: "shipment",
  });

  await notifyAgentForCustomer(
    customerId,
    outcome === "successful" ? "Parcel Delivered" : "Delivery Failed",
    outcome === "successful"
      ? `Shipment${trackingText} for ${customerName} has been delivered successfully.`
      : `Delivery attempt${trackingText} for ${customerName} failed.`,
    shipmentId,
  );
};
