import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  PackageSearch,
  Plane,
  Ship,
} from "lucide-react";
import { ShipsGoEmbedCard } from "@/components/tracking/ShipsGoEmbedCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuthContext } from "@/components/auth/AuthContext";
import { CustomerProfileGate } from "@/components/customer/CustomerProfileGate";
import {
  buildShipsGoEmbedUrl,
  formatTrackingServiceType,
  guessShipsGoEmbedParamsFromQuery,
  lookupTrackingDetails,
  type ShipsGoTransport,
  type TrackingDetails,
  type TrackingItem,
} from "@/lib/tracking";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";

const statusLabel: Record<string, string> = {
  saved_pickup: "Created",
  saved_dropoff: "Incoming Parcels",
  received: "Need Action",
  requested_pickup: "Submitted",
  approved: "Confirm Shipment",
  assigned: "Outgoing Parcel",
  supplied: "In Transit",
  delivered: "Ready for Collection",
  closed: "Collected",
  returned: "Returned",
  returned_stock: "Returned to Stock",
  returned_delivered: "Returned and Delivered",
  submitted: "Submitted",
  confirmed: "Confirm Shipment",
  outgoing: "Outgoing Parcel",
  in_transit: "In Transit",
  arrived: "Ready for Collection",
  collected: "Collected",
};

const statusIcon = (status: string) => {
  const normalized = status?.toLowerCase() || "";
  if (["delivered", "closed", "arrived", "collected"].includes(normalized)) {
    return <CheckCircle2 className="h-4 w-4 text-primary" />;
  }
  if (["supplied", "assigned", "outgoing", "in_transit"].includes(normalized)) {
    return <Ship className="h-4 w-4 text-primary" />;
  }
  if (normalized.includes("air")) return <Plane className="h-4 w-4 text-primary" />;
  if (normalized.includes("return") || normalized.includes("problem")) {
    return <AlertCircle className="h-4 w-4 text-destructive" />;
  }
  return <Clock className="h-4 w-4 text-muted-foreground" />;
};

const getStatusLabel = (status: string) => statusLabel[status] || status || "Unknown";

export const TrackingPageContent = () => {
  const { formatAmount } = useDefaultCurrency();
  const { userRole } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();

  // Shipment search (independent of map)
  const [trackingId, setTrackingId] = useState("");
  const [result, setResult] = useState<TrackingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const autoTrackedKeyRef = useRef<string | null>(null);

  // Map search (completely independent — its own input, its own URL)
  const [mapQuery, setMapQuery] = useState("");
  const [mapTransport, setMapTransport] = useState<ShipsGoTransport>("ocean");
  const [embedUrl, setEmbedUrl] = useState<string | null>(buildShipsGoEmbedUrl(null, null));
  const [embedContext, setEmbedContext] = useState<{ transport: ShipsGoTransport; query: string } | null>(null);

  const handleTrack = useCallback(async (inputQuery?: string) => {
    const query = (inputQuery ?? trackingId).trim();
    setSearched(true);
    setErrorMessage("");
    setResult(null);

    if (!query) {
      setErrorMessage("Enter a tracking number to continue.");
      return;
    }

    autoTrackedKeyRef.current = query;
    setIsLoading(true);

    const details = await lookupTrackingDetails(query, { userRole });

    if (details) {
      setResult(details);
    } else {
      setErrorMessage("No shipment found with that tracking number.");
    }

    const next = new URLSearchParams();
    next.set("query", query);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }

    setIsLoading(false);
  }, [searchParams, setSearchParams, trackingId, userRole]);

  useEffect(() => {
    const query = searchParams.get("query")?.trim() || "";
    if (!query) {
      autoTrackedKeyRef.current = null;
      return;
    }
    setTrackingId(query);
    setSearched(true);
    if (autoTrackedKeyRef.current === query) return;
    autoTrackedKeyRef.current = query;
    void handleTrack(query);
  }, [handleTrack, searchParams]);

  const handleMapSearch = useCallback((rawValue?: string, transport?: ShipsGoTransport) => {
    const value = (rawValue ?? mapQuery).trim();
    const chosenTransport = transport ?? mapTransport;
    if (!value) {
      setEmbedUrl(buildShipsGoEmbedUrl(null, null));
      setEmbedContext(null);
      return;
    }
    const guessed = guessShipsGoEmbedParamsFromQuery(value);
    const params = guessed || { transport: chosenTransport, query: value };
    setEmbedUrl(buildShipsGoEmbedUrl(null, params));
    setEmbedContext(params);
  }, [mapQuery, mapTransport]);

  const hydratedResult = useMemo(() => {
    if (!result) return null;

    const items = result.items || [];
    const sumBy = (getter: (item: TrackingItem) => number) =>
      items.reduce((sum, item) => sum + getter(item), 0);

    return {
      ...result,
      item_count: Number(result.item_count || 0) > 0 ? Number(result.item_count) : items.length,
      shipping_fee:
        Number(result.shipping_fee || 0) > 0
          ? Number(result.shipping_fee)
          : sumBy((item) => Number(item.shipping_fee || 0)),
      item_value:
        Number(result.item_value || 0) > 0
          ? Number(result.item_value)
          : sumBy((item) => Number(item.item_value || 0)),
      weight:
        Number(result.weight || 0) > 0
          ? Number(result.weight)
          : sumBy((item) => Number(item.weight || 0)),
      cbm:
        Number(result.cbm || 0) > 0
          ? Number(result.cbm)
          : sumBy((item) => Number(item.cbm || 0)),
    };
  }, [result]);

  return (
    <div className="space-y-6">
        <PageHeader
          title="Track Shipment"
          
        />

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                placeholder="Shipment code, custom tracking number, or consolidated tracking number"
                value={trackingId}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setTrackingId(nextValue);
                  setResult(null);
                  setErrorMessage("");
                  if (searchParams.get("query")) {
                    autoTrackedKeyRef.current = null;
                    setSearchParams({}, { replace: true });
                  }
                  if (!nextValue.trim()) {
                    autoTrackedKeyRef.current = null;
                    setSearched(false);
                  }
                }}
                onKeyDown={(event) => event.key === "Enter" && handleTrack()}
                className="flex-1"
              />
              <Button onClick={() => handleTrack()} disabled={isLoading} className="sm:min-w-32">
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PackageSearch className="mr-2 h-4 w-4" />
                )}
                {isLoading ? "Searching..." : "Track"}
              </Button>
            </div>
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          </CardContent>
        </Card>

        {/* Independent live carrier map search — not connected to internal tracking numbers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" /> Live Carrier Map Search
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={mapTransport}
                onChange={(event) => setMapTransport(event.target.value as ShipsGoTransport)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-40"
              >
                <option value="ocean">Ocean</option>
                <option value="air">Air</option>
              </select>
              <Input
                placeholder="Container / BL / AWB / Booking number"
                value={mapQuery}
                onChange={(event) => setMapQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleMapSearch()}
                className="flex-1"
              />
              <Button onClick={() => handleMapSearch()} className="sm:min-w-32">
                <MapPin className="mr-2 h-4 w-4" />
                Load Map
              </Button>
            </div>
          </CardContent>
        </Card>

        <ShipsGoEmbedCard
          embedUrl={embedUrl}
          fallbackMapUrl={null}
          isLoading={false}
          transport={embedContext?.transport ?? null}
          carrierQuery={embedContext?.query ?? null}
          errorMessage={null}
          showPlaceholder={Boolean(embedContext?.query)}
          listenForContainerMessages
        />

        {hydratedResult ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {statusIcon(hydratedResult.status)} Tracking Details
                <Badge variant="outline" className="ml-2 text-xs capitalize">
                  {hydratedResult.kind}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{getStatusLabel(hydratedResult.status)}</Badge>
                  <span className="text-muted-foreground">
                    {hydratedResult.origin || "Origin"} to {hydratedResult.destination || "Destination"}
                  </span>
                </div>
                <p className="mt-2 text-muted-foreground">
                  {hydratedResult.status_message || "No status message available yet."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Reference</p>
                  <p className="font-mono font-medium">{hydratedResult.code}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tracking Number</p>
                  <p className="font-mono font-medium">{hydratedResult.tracking_number || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">AWB/BL No.</p>
                  <p className="font-mono font-medium">{hydratedResult.airway_bill_number || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Items</p>
                  <p className="font-medium">{hydratedResult.item_count}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Shipping Fee</p>
                  <p className="font-medium">{formatAmount(Number(hydratedResult.shipping_fee || 0))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Item Value</p>
                  <p className="font-medium">{formatAmount(Number(hydratedResult.item_value || 0))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Weight</p>
                  <p className="font-medium">{Number(hydratedResult.weight || 0).toFixed(2)} kg</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CBM</p>
                  <p className="font-medium">{Number(hydratedResult.cbm || 0).toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium">{format(new Date(hydratedResult.created_at), "PP p")}</p>
                </div>
                {hydratedResult.pickup_date ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Pickup Date</p>
                    <p className="font-medium">{format(new Date(hydratedResult.pickup_date), "PP p")}</p>
                  </div>
                ) : null}
                {hydratedResult.estimated_delivery_date ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated Delivery</p>
                    <p className="font-medium">{format(new Date(hydratedResult.estimated_delivery_date), "PP p")}</p>
                  </div>
                ) : null}
                {hydratedResult.actual_delivery_date ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Actual Delivery</p>
                    <p className="font-medium">{format(new Date(hydratedResult.actual_delivery_date), "PP p")}</p>
                  </div>
                ) : null}
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="font-semibold">Items</h3>
                <div className="space-y-3">
                  {hydratedResult.items.map((item) => (
                    <Card key={item.id} className="border-border/70">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{item.description}</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <p>
                          <span className="text-muted-foreground">Code:</span> {item.code}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Tracking Number:</span>{" "}
                          <span className="font-mono">{item.tracking_number}</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">AWB/BL No.:</span>{" "}
                          <span className="font-mono">{item.airway_bill_number || "-"}</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Status:</span> {getStatusLabel(item.status)}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Service:</span>{" "}
                          {formatTrackingServiceType(item.service_type)}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Quantity:</span> {item.quantity}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Weight:</span> {Number(item.weight || 0).toFixed(2)} kg
                        </p>
                        <p>
                          <span className="text-muted-foreground">CBM:</span> {Number(item.cbm || 0).toFixed(4)}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Shipping Fee:</span>{" "}
                          {formatAmount(Number(item.shipping_fee || 0))}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="font-semibold">Status History</h3>
                {hydratedResult.events.length > 0 ? (
                  <div className="space-y-2">
                    {hydratedResult.events.map((event, index) => {
                      const updatedMessage = event.message.split(hydratedResult.code).join(
                        hydratedResult.tracking_number || hydratedResult.code
                      );
                      return (
                        <div key={`${event.created_at}-${index}`} className="rounded-md border p-3">
                          <p className="text-sm font-medium">{event.title}</p>
                          <p className="text-sm text-muted-foreground">{updatedMessage}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {format(new Date(event.created_at), "PP p")}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No status history available yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

      </div>
  );
};

const CustomerTracking = () => (
  <CustomerProfileGate>
    <TrackingPageContent />
  </CustomerProfileGate>
);

export default CustomerTracking;
