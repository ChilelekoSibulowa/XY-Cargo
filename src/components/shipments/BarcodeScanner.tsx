import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Scan, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BarcodeScannerProps {
  onShipmentFound: (shipment: any) => void;
}

export const BarcodeScanner = ({ onShipmentFound }: BarcodeScannerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const searchShipment = async (code: string) => {
    if (!code.trim()) {
      toast.error("Please enter a shipment code");
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("shipments")
        .select(`
          *,
          customer:customers(full_name, phone, email),
          receiver:receivers(full_name, phone, address, city),
          branch:branches!shipments_branch_id_fkey(name)
        `)
        .eq("code", code.trim().toUpperCase())
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        toast.error(`Shipment not found: ${code}`);
        return;
      }

      onShipmentFound(data);
      setIsOpen(false);
      setManualCode("");
      toast.success(`Found shipment: ${data.code}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to search shipment");
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchShipment(manualCode);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Scan className="h-4 w-4 mr-2" />
          Scan Barcode
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            Scan or Enter Shipment Code
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Manual Entry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  placeholder="Enter shipment code (e.g., SHP-XXXXXXXX)"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  disabled={isSearching}
                  className="font-mono"
                />
                <Button
                  onClick={() => searchShipment(manualCode)}
                  disabled={isSearching || !manualCode.trim()}
                >
                  {isSearching ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use a barcode scanner to automatically input the code, or type it manually.
              </p>
            </CardContent>
          </Card>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Point your barcode scanner at the shipment label to search instantly.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
