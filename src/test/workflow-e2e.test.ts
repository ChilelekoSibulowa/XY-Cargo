import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase client so notifications.ts can resolve the customer name
// without hitting the network and so sendNotification stays a no-op we can spy on.
const customerName = "Acme Logistics Ltd";

vi.mock("@/integrations/supabase/client", () => {
  const customerSelect = {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: { full_name: customerName }, error: null }),
      }),
    }),
  };
  return {
    supabase: {
      from: (_table: string) => customerSelect,
      functions: {
        invoke: vi.fn(async () => ({ data: { ok: true }, error: null })),
      },
    },
  };
});

import {
  WORKFLOW_LABELS,
  WORKFLOW_ORDER,
  getStageLabel,
  getStageNoun,
  isParcelStage,
  isShipmentStage,
  PAYMENT_LABELS,
} from "@/lib/workflowLabels";
import { notifyStatusChange, notifyPaymentReceived } from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";

const TRACK = "XY-TEST-0001";
const CUSTOMER_ID = "cust-1";
const SHIPMENT_ID = "ship-1";

const lastInvoke = () => {
  const fn = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;
  const call = fn.mock.calls.at(-1);
  if (!call) throw new Error("send-notification was never invoked");
  return call[1] as { body: any };
};

beforeEach(() => {
  (supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockClear();
});

describe("Workflow stage labels (single source of truth)", () => {
  it("maps every approved DB status to the approved UI label", () => {
    const expected: Record<string, string> = {
      saved_pickup: "Created",
      saved_dropoff: "Incoming",
      received: "Need Action",
      need_action: "Need Action",
      requested_pickup: "Submitted",
      approved: "Confirm Shipment",
      assigned: "Outgoing Parcel",
      supplied: "In Transit",
      delivered: "Ready for Collection",
      arrived: "Ready for Collection",
      closed: "Collected",
      collected: "Collected",
      pending: "Need Action",
      submitted: "Submitted",
      confirmed: "Confirm Shipment",
      outgoing: "Outgoing Parcel",
      in_transit: "In Transit",
    };
    for (const [status, label] of Object.entries(expected)) {
      expect(WORKFLOW_LABELS[status]).toBe(label);
      expect(getStageLabel(status)).toBe(label);
    }
  });

  it("classifies parcel vs shipment stages correctly", () => {
    expect(isParcelStage("saved_pickup")).toBe(true);
    expect(isParcelStage("received")).toBe(true);
    expect(isShipmentStage("requested_pickup")).toBe(true);
    expect(isShipmentStage("approved")).toBe(true);
    expect(getStageNoun("saved_pickup")).toBe("parcel");
    expect(getStageNoun("requested_pickup")).toBe("shipment");
  });

  it("orders stages sequentially without skipping", () => {
    expect(WORKFLOW_ORDER).toEqual([
      "saved_pickup",
      "saved_dropoff",
      "received",
      "requested_pickup",
      "approved",
      "assigned",
      "supplied",
      "delivered",
      "closed",
    ]);
  });

  it("maps payment statuses to Unpaid / Paid only", () => {
    expect(PAYMENT_LABELS.pending).toBe("Unpaid");
    expect(PAYMENT_LABELS.completed).toBe("Paid");
  });
});

describe("End-to-end SINGLE shipment lifecycle notifications", () => {
  const stages: Array<{
    status: string;
    title: string;
    contains: string[];
  }> = [
    {
      status: "saved_dropoff",
      title: "Parcel Incoming",
      contains: [customerName, TRACK, "on the way to the origin warehouse"],
    },
    {
      status: "received",
      title: "Parcel Arrived",
      contains: [customerName, TRACK, "arrived at the origin warehouse", "awaiting your action"],
    },
    {
      status: "requested_pickup",
      title: "Shipment Submitted",
      contains: [customerName, "awaiting your action"],
    },
    {
      status: "approved",
      title: "Confirm Shipment",
      contains: [customerName, "awaiting confirmation", "confirm your shipment"],
    },
    {
      status: "assigned",
      title: "Shipment Confirmed",
      contains: [customerName, "confirmed successfully"],
    },
    {
      status: "supplied",
      title: "Shipment In Transit",
      contains: [customerName, TRACK, "in transit"],
    },
    {
      status: "delivered",
      title: "Ready for Collection",
      contains: [customerName, TRACK, "destination warehouse", "awaiting collection"],
    },
    {
      status: "closed",
      title: "Shipment Collected",
      contains: [customerName, TRACK, "collected successfully"],
    },
  ];

  it.each(stages)("$status fires the approved $title notification", async ({ status, title, contains }) => {
    await notifyStatusChange(CUSTOMER_ID, TRACK, SHIPMENT_ID, status, { handlingMethod: "single" });
    const { body } = lastInvoke();
    expect(body.title).toBe(title);
    expect(body.event_type).toBe(`shipment_${status}`);
    expect(body.notification_type).toBe("shipment");
    for (const piece of contains) {
      expect(body.message).toContain(piece);
      expect(body.sms_message).toContain(piece);
    }
  });

  it("payment-received notification uses approved wording", async () => {
    await notifyPaymentReceived(CUSTOMER_ID, "250", TRACK);
    const { body } = lastInvoke();
    expect(body.message.toLowerCase()).toContain("received successfully");
    expect(body.message).toContain(customerName);
  });
});

describe("End-to-end CONSOLIDATED lifecycle notifications", () => {
  it("received stage instructs the customer to consolidate", async () => {
    await notifyStatusChange(CUSTOMER_ID, TRACK, SHIPMENT_ID, "received", {
      handlingMethod: "consolidated",
    });
    const { body } = lastInvoke();
    expect(body.title).toBe("Need Action");
    expect(body.message).toContain("Kindly log in and consolidate your items");
  });

  it("submitted stage confirms successful consolidation", async () => {
    await notifyStatusChange(CUSTOMER_ID, TRACK, SHIPMENT_ID, "requested_pickup", {
      handlingMethod: "consolidated",
    });
    const { body } = lastInvoke();
    expect(body.title).toBe("Shipment Submitted");
    expect(body.message).toContain("consolidated successfully");
  });

  it("walks the full sequential lifecycle without skipping any stage", async () => {
    const order = [
      "saved_dropoff",
      "received",
      "requested_pickup",
      "approved",
      "assigned",
      "supplied",
      "delivered",
      "closed",
    ];
    const fn = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;
    fn.mockClear();
    for (const status of order) {
      await notifyStatusChange(CUSTOMER_ID, TRACK, SHIPMENT_ID, status, { handlingMethod: "consolidated" });
    }
    const titles = fn.mock.calls.map((c) => (c[1] as any).body.title);
    expect(titles).toEqual([
      "Parcel Incoming",
      "Need Action",
      "Shipment Submitted",
      "Confirm Shipment",
      "Shipment Confirmed",
      "Shipment In Transit",
      "Ready for Collection",
      "Shipment Collected",
    ]);
  });
});
