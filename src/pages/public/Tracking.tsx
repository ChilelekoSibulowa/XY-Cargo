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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import {
  buildShipsGoEmbedUrl,
  formatTrackingServiceType,
  getShipsGoEmbedParams,
  guessShipsGoEmbedParamsFromQuery,
  lookupTrackingDetails,
  parseShipsGoTransport,
  type ShipsGoData,
  type ShipsGoTransport,
  type TrackingDetails,
  type TrackingItem,
} from "@/lib/tracking";
import { useDefaultCurrency } from "@/hooks/useDefaultCurrency";

const DEFAULT_SHIPSGO_EMBED_URL = buildShipsGoEmbedUrl(null, null);

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

const Tracking = () => {
  const { formatAmount } = useDefaultCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const [isEmbedLoading, setIsEmbedLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<TrackingDetails | null>(null);
  const [liveData, setLiveData] = useState<ShipsGoData | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(DEFAULT_SHIPSGO_EMBED_URL);
  const [embedContext, setEmbedContext] = useState<{ transport: ShipsGoTransport; query: string } | null>(null);
  const [embedErrorMessage, setEmbedErrorMessage] = useState<string | null>(null);
  const autoTrackedKeyRef = useRef<string | null>(null);

  const syncTrackingSearchParams = useCallback(
    (query: string, transport: ShipsGoTransport | null) => {
      const next = new URLSearchParams();
      if (query) next.set("query", query);
      if (transport) next.set("transport", transport);
      if (next.toString() !== searchParams.toString()) {
        setSearchParams(next, { replace: true });
      }
    },
    [searchParams, setSearchParams]
  );

  const handleTrack = useCallback(async (inputQuery?: string, preferredTransport?: ShipsGoTransport | null) => {
    const query = (inputQuery ?? trackingNumber).trim();
    setErrorMessage("");
    setResult(null);
    setLiveData(null);
    setEmbedErrorMessage(null);

    if (!query) {
      setEmbedUrl(DEFAULT_SHIPSGO_EMBED_URL);
      setEmbedContext(null);
      syncTrackingSearchParams("", null);
      setErrorMessage("Enter a tracking number to continue.");
      return;
    }

    const immediateParams =
      preferredTransport && query
        ? { transport: preferredTransport, query }
        : guessShipsGoEmbedParamsFromQuery(query);
    const autoTrackedKey = `${immediateParams?.transport || preferredTransport || ""}:${query}`;
    autoTrackedKeyRef.current = autoTrackedKey;

    setEmbedUrl(buildShipsGoEmbedUrl(null, immediateParams));
    setEmbedContext(immediateParams);
    syncTrackingSearchParams(query, immediateParams?.transport ?? preferredTransport ?? null);
    setIsLoading(true);
    setIsEmbedLoading(true);

    const details = await lookupTrackingDetails(query);

    if (details) {
      setResult(details);
    }

    const resolvedTrackingParams = getShipsGoEmbedParams(details) || immediateParams;
    const liveTrackingReference = resolvedTrackingParams?.query || null;
    const shouldFetchLiveData =
      Boolean(liveTrackingReference) && resolvedTrackingParams?.transport === "ocean";

    const resolvedTransport = resolvedTrackingParams?.transport ?? preferredTransport ?? null;
    autoTrackedKeyRef.current = `${resolvedTransport || ""}:${query}`;

    setIsEmbedLoading(false);
    setIsLiveLoading(shouldFetchLiveData);
    setEmbedUrl(buildShipsGoEmbedUrl(null, resolvedTrackingParams));
    setEmbedContext(resolvedTrackingParams);
    syncTrackingSearchParams(query, resolvedTransport);

    const liveResponse = await (shouldFetchLiveData
      ? Promise.resolve(
        supabase.functions.invoke("shipsgo-tracking", {
          body: {
            action: "track",
            tracking_number: liveTrackingReference,
          },
        }),
      )
      : Promise.resolve(null));

    let hasExternalTracking = false;

    if (liveResponse) {
      const response = liveResponse;
      const liveResult = response?.data as { success?: boolean; data?: ShipsGoData } | null | undefined;

      if (!response?.error && liveResult?.success && liveResult.data) {
        setLiveData(liveResult.data);
        hasExternalTracking = true;
      }
    }

    if (!details && !hasExternalTracking) {
      if (immediateParams) {
        // If it's a valid container/AWB format, keep the embed URL & context as a fallback
        setErrorMessage("No local shipment record found. Displaying map search fallback...");
      } else {
        setEmbedContext(null);
        setEmbedUrl(DEFAULT_SHIPSGO_EMBED_URL);
        setErrorMessage("No shipment found with that tracking number.");
      }
    }

    setIsEmbedLoading(false);
    setIsLiveLoading(false);
    setIsLoading(false);
  }, [searchParams, setSearchParams, syncTrackingSearchParams, trackingNumber]);

  useEffect(() => {
    const query = searchParams.get("query")?.trim() || "";
    const transport = parseShipsGoTransport(searchParams.get("transport"));

    if (!query) {
      autoTrackedKeyRef.current = null;
      setEmbedUrl(DEFAULT_SHIPSGO_EMBED_URL);
      setEmbedContext(null);
      return;
    }

    setTrackingNumber(query);
    const key = `${transport || ""}:${query}`;
    if (autoTrackedKeyRef.current === key) return;
    autoTrackedKeyRef.current = key;
    void handleTrack(query, transport);
  }, [handleTrack, searchParams]);

  const liveMovements = useMemo(() => {
    if (!liveData) return [];
    const containers = liveData.containers || (Array.isArray(liveData) ? liveData : []);
    const movements: Array<{ location: string; date: string; description: string; isActual: boolean }> = [];

    if (Array.isArray(containers)) {
      containers.forEach((container: any) => {
        if (!Array.isArray(container.movements)) return;
        container.movements.forEach((movement: any) => {
          movements.push({
            location: movement.location || movement.port || "",
            date: movement.date || movement.dateTime || "",
            description: movement.description || movement.status || movement.event || "",
            isActual: movement.isActual !== false,
          });
        });
      });
    }

    return movements;
  }, [liveData]);

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

  const mapUrl = useMemo(() => {
    if (!liveData) return null;
    const points = liveData.mapPoints || [];
    if (Array.isArray(points) && points.length > 0) {
      const lastPoint = points[points.length - 1];
      if (lastPoint?.lat && lastPoint?.lng) {
        return `https://www.openstreetmap.org/export/embed.html?bbox=${lastPoint.lng - 2},${lastPoint.lat - 2},${lastPoint.lng + 2},${lastPoint.lat + 2}&layer=mapnik&marker=${lastPoint.lat},${lastPoint.lng}`;
      }
    }
    return null;
  }, [liveData]);

  const hasAnyResult = Boolean(result || liveData);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Tracking</p>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl md:text-4xl">Track your shipment</h1>

      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Shipment code, custom tracking number, or consolidated tracking number"
              value={trackingNumber}
              onChange={(event) => {
                const nextValue = event.target.value;
                setTrackingNumber(nextValue);
                setResult(null);
                setLiveData(null);
                setEmbedContext(null);
                setEmbedUrl(DEFAULT_SHIPSGO_EMBED_URL);
                setEmbedErrorMessage(null);
                setErrorMessage("");
                if (searchParams.get("query")) {
                  autoTrackedKeyRef.current = null;
                  setSearchParams({}, { replace: true });
                }
                if (!nextValue.trim()) {
                  autoTrackedKeyRef.current = null;
                }
              }}
              onKeyDown={(event) => event.key === "Enter" && handleTrack()}
              className="flex-1"
            />
            <Button className="shrink-0 gap-2" onClick={() => handleTrack()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageSearch className="h-4 w-4" />}
              {isLoading ? "Searching..." : "Track"}
            </Button>
          </div>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        </CardContent>
      </Card>

      <ShipsGoEmbedCard
        embedUrl={embedUrl}
        fallbackMapUrl={mapUrl}
        isLoading={isEmbedLoading}
        transport={embedContext?.transport ?? null}
        carrierQuery={embedContext?.query ?? null}
        errorMessage={embedErrorMessage}
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
                    const updatedMessage = event.message.replace(
                      new RegExp(hydratedResult.code, 'g'),
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

      {isLiveLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading live tracking data...</span>
          </CardContent>
        </Card>
      ) : null}

      {liveData ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" /> Live Carrier Updates
              {liveData.shippingLine ? (
                <Badge variant="outline" className="ml-2 text-xs">
                  {liveData.shippingLine}
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {liveData.vesselName || liveData.pol || liveData.pod || liveData.eta ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {liveData.vesselName ? (
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Vessel</p>
                    <p className="text-sm font-medium truncate">{liveData.vesselName}</p>
                  </div>
                ) : null}
                {liveData.pol ? (
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Port of Loading</p>
                    <p className="text-sm font-medium truncate">{liveData.pol}</p>
                  </div>
                ) : null}
                {liveData.pod ? (
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Port of Discharge</p>
                    <p className="text-sm font-medium truncate">{liveData.pod}</p>
                  </div>
                ) : null}
                {liveData.eta || liveData.arrivalDate ? (
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">ETA</p>
                    <p className="text-sm font-medium">{liveData.eta || liveData.arrivalDate}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {liveMovements.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Movement History</p>
                <div className="relative ml-2 space-y-3 border-l-2 border-primary/30 pl-6">
                  {liveMovements.map((movement, index) => (
                    <div key={`${movement.date}-${index}`} className="relative">
                      <div
                        className={`absolute -left-[1.625rem] top-0.5 h-3 w-3 rounded-full border-2 ${movement.isActual
                            ? "border-primary bg-primary/20"
                            : "border-muted-foreground/40 bg-background"
                          }`}
                      />
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">{movement.description || movement.location}</p>
                          {movement.location && movement.description ? (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" /> {movement.location}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-muted-foreground">{movement.date}</p>
                          {!movement.isActual ? (
                            <Badge variant="outline" className="text-[10px]">
                              Estimated
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  Tracking data received. The shipment may still be being processed by the carrier.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default Tracking;
