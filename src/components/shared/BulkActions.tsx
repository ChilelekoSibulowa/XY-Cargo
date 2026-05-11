import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageSquare, CheckCircle, Send, Users } from "lucide-react";

export type BulkActionType =
  | "send_message"
  | "mark_ready_collection"
  | "update_status"
  | "custom_action";

export interface BulkActionConfig {
  type: BulkActionType;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
  requiresConfirmation?: boolean;
  requiresInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
}

export const bulkActionConfigs: Record<BulkActionType, BulkActionConfig> = {
  send_message: {
    type: "send_message",
    label: "Send Bulk Message",
    icon: MessageSquare,
    description: "Send a custom message to all selected customers",
    requiresConfirmation: true,
    requiresInput: true,
    inputLabel: "Message",
    inputPlaceholder: "Enter your message to send to selected customers...",
  },
  mark_ready_collection: {
    type: "mark_ready_collection",
    label: "Mark Ready for Collection",
    icon: CheckCircle,
    description: "Mark selected shipments as ready for collection",
    requiresConfirmation: true,
  },
  update_status: {
    type: "update_status",
    label: "Update Status",
    icon: Send,
    description: "Update status for selected shipments",
    requiresConfirmation: true,
  },
  custom_action: {
    type: "custom_action",
    label: "Custom Action",
    icon: Users,
    description: "Perform custom bulk action",
    requiresConfirmation: true,
  },
};

interface BulkActionsProps<T> {
  selectedItems: T[];
  onClearSelection: () => void;
  onActionComplete?: () => void;
  availableActions: BulkActionType[];
  itemLabel: string;
  renderItemSummary: (item: T) => string;
  onExecuteAction: (actionType: BulkActionType, items: T[], inputValue?: string) => Promise<void>;
}

export function BulkActions<T>({
  selectedItems,
  onClearSelection,
  onActionComplete,
  availableActions,
  itemLabel,
  renderItemSummary,
  onExecuteAction,
}: BulkActionsProps<T>) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<BulkActionType | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);

  const handleActionSelect = (actionType: BulkActionType) => {
    setSelectedAction(actionType);
    setInputValue("");
    setIsDialogOpen(true);
  };

  const handleExecuteAction = async () => {
    if (!selectedAction) return;

    const config = bulkActionConfigs[selectedAction];
    if (config.requiresInput && !inputValue.trim()) {
      toast.error(`Please enter a ${config.inputLabel?.toLowerCase()}`);
      return;
    }

    setIsExecuting(true);
    try {
      await onExecuteAction(selectedAction, selectedItems, inputValue.trim() || undefined);
      toast.success(`Bulk action completed successfully for ${selectedItems.length} ${itemLabel.toLowerCase()}`);
      onClearSelection();
      onActionComplete?.();
      setIsDialogOpen(false);
      setSelectedAction(null);
      setInputValue("");
    } catch (error: any) {
      toast.error(error.message || "Failed to execute bulk action");
    } finally {
      setIsExecuting(false);
    }
  };

  if (selectedItems.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Users className="h-5 w-5 text-blue-600" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-blue-900">
              {selectedItems.length} {itemLabel}{selectedItems.length !== 1 ? "s" : ""} selected
            </span>
            <Badge variant="secondary">{selectedItems.length}</Badge>
          </div>
          <div className="text-sm text-blue-700 mt-1">
            {selectedItems.slice(0, 3).map(renderItemSummary).join(", ")}
            {selectedItems.length > 3 && ` and ${selectedItems.length - 3} more`}
          </div>
        </div>
        <div className="flex gap-2">
          {availableActions.map((actionType) => {
            const config = bulkActionConfigs[actionType];
            const Icon = config.icon;
            return (
              <Button
                key={actionType}
                variant="outline"
                size="sm"
                onClick={() => handleActionSelect(actionType)}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                {config.label}
              </Button>
            );
          })}
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear Selection
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAction ? bulkActionConfigs[selectedAction].label : "Bulk Action"}
            </DialogTitle>
          </DialogHeader>

          {selectedAction && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {bulkActionConfigs[selectedAction].description}
              </div>

              <div className="max-h-32 overflow-y-auto space-y-2">
                <Label className="text-sm font-medium">Selected {itemLabel}s:</Label>
                {selectedItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <Checkbox checked disabled />
                    {renderItemSummary(item)}
                  </div>
                ))}
              </div>

              {bulkActionConfigs[selectedAction].requiresInput && (
                <div className="space-y-2">
                  <Label htmlFor="bulk-input">
                    {bulkActionConfigs[selectedAction].inputLabel}
                  </Label>
                  <Textarea
                    id="bulk-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={bulkActionConfigs[selectedAction].inputPlaceholder}
                    rows={4}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExecuteAction} disabled={isExecuting}>
              {isExecuting ? "Executing..." : "Execute Action"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}