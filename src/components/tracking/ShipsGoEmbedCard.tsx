import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildShipsGoEmbedUrl, DEFAULT_SHIPSGO_EMBED_TOKEN } from "@/lib/tracking";
import type { ShipsGoTransport } from "@/lib/tracking";

type ShipsGoEmbedCardProps = {
  embedUrl: string | null;
  fallbackMapUrl?: string | null;
  isLoading: boolean;
  transport?: ShipsGoTransport | null;
  carrierQuery?: string | null;
  errorMessage?: string | null;
  showPlaceholder?: boolean;
  listenForContainerMessages?: boolean;
};

const transportLabel: Record<ShipsGoTransport, string> = {
  air: "Air",
  ocean: "Ocean",
};

export const ShipsGoEmbedCard = ({
  embedUrl,
  fallbackMapUrl,
  isLoading,
  transport,
  carrierQuery,
  errorMessage,
  showPlaceholder,
  listenForContainerMessages,
}: ShipsGoEmbedCardProps) => {
  const iframeId = "shipsgo-embed";
  const [currentIframeUrl, setCurrentIframeUrl] = useState(embedUrl);

  useEffect(() => {
    setCurrentIframeUrl(embedUrl);
  }, [embedUrl]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const existingScript = document.querySelector('script[data-shipsgo-embed="true"]');
    if (existingScript) return;

    const script = document.createElement("script");
    script.src = "https://embed.shipsgo.com/embed-integration.js";
    script.async = true;
    script.dataset.shipsgoEmbed = "true";
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!listenForContainerMessages) return;

    const handleMessage = (event: MessageEvent) => {
      const containerCode = event.data?.Parameters?.ContainerCode;
      if (event.data?.Action !== "LoadNewContainerCode" || typeof containerCode !== "string") return;

      const currentUrl = currentIframeUrl || embedUrl;
      const parsedUrl = currentUrl ? new URL(currentUrl) : null;
      const nextUrl = buildShipsGoEmbedUrl(
        parsedUrl?.searchParams.get("token") || DEFAULT_SHIPSGO_EMBED_TOKEN,
        {
          transport: "ocean",
          query: containerCode.trim().toUpperCase(),
        },
      );
      if (nextUrl) {
        setCurrentIframeUrl(nextUrl);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [currentIframeUrl, embedUrl, listenForContainerMessages]);

  if (!isLoading && !embedUrl && !fallbackMapUrl && !errorMessage && !showPlaceholder) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4 text-primary" />
          Live Tracking Map
          {transport ? (
            <Badge variant="outline" className="ml-2 text-xs">
              {transportLabel[transport]}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/30 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading tracking map...</span>
          </div>
        ) : null}

        {!isLoading && fallbackMapUrl ? (
          <div className="overflow-hidden rounded-lg border">
            <iframe
              src={fallbackMapUrl}
              className="h-[560px] w-full sm:h-[650px]"
              title="Shipment Location Map"
              loading="lazy"
            />
          </div>
        ) : null}

        {!isLoading && !fallbackMapUrl && currentIframeUrl ? (
          <div className="overflow-hidden rounded-lg border">
            <iframe
              src={currentIframeUrl}
              id={iframeId}
              className="h-[560px] w-full sm:h-[650px]"
              title="ShipsGo Tracking Map"
              loading="lazy"
            />
          </div>
        ) : null}

        {!isLoading && !currentIframeUrl && !fallbackMapUrl && errorMessage ? (
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Map unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
          </div>
        ) : null}

        {!isLoading && !currentIframeUrl && !fallbackMapUrl && !errorMessage && showPlaceholder ? (
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Map pending</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Search using a valid AWB, BL, booking, or container reference to load the live carrier map.
            </p>
          </div>
        ) : null}

        {carrierQuery ? (
          <p className="text-xs text-muted-foreground">
            Carrier reference: <span className="font-mono">{carrierQuery}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};
