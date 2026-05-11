import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  saved_pickup: { label: "Created", className: "bg-stat-yellow/10 text-stat-yellow border-stat-yellow/20" },
  saved_dropoff: { label: "Incoming", className: "bg-stat-yellow/10 text-stat-yellow border-stat-yellow/20" },
  requested_pickup: { label: "Submitted", className: "bg-stat-blue/10 text-stat-blue border-stat-blue/20" },
  approved: { label: "Confirm Shipment", className: "bg-stat-blue/10 text-stat-blue border-stat-blue/20" },
  assigned: { label: "Outgoing Parcel", className: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
  received: { label: "Need Action", className: "bg-stat-blue/10 text-stat-blue border-stat-blue/20" },
  delivered: { label: "Ready for Collection", className: "bg-stat-green/10 text-stat-green border-stat-green/20" },
  supplied: { label: "In Transit", className: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  in_transit: { label: "In Transit", className: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  arrived: { label: "Ready for Collection", className: "bg-stat-green/10 text-stat-green border-stat-green/20" },
  returned: { label: "Returned", className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  returned_stock: { label: "Returned Stock", className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  returned_delivered: { label: "Returned & Delivered", className: "bg-stat-green/10 text-stat-green border-stat-green/20" },
  closed: { label: "Collected", className: "bg-muted text-muted-foreground border-muted-foreground/20" },
  requested: { label: "Requested", className: "bg-stat-yellow/10 text-stat-yellow border-stat-yellow/20" },
  successful: { label: "Successful Delivery", className: "bg-stat-green/10 text-stat-green border-stat-green/20" },
  done: { label: "Done", className: "bg-stat-green/10 text-stat-green border-stat-green/20" },
  pending: { label: "Pending", className: "bg-stat-yellow/10 text-stat-yellow border-stat-yellow/20" },
  completed: { label: "Completed", className: "bg-stat-green/10 text-stat-green border-stat-green/20" },
  submitted: { label: "Submitted", className: "bg-stat-yellow/10 text-stat-yellow border-stat-yellow/20" },
  confirmed: { label: "Confirmed", className: "bg-stat-blue/10 text-stat-blue border-stat-blue/20" },
  outgoing: { label: "Outgoing Parcel", className: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
  collected: { label: "Collected", className: "bg-muted text-muted-foreground border-muted-foreground/20" },
  cancelled: { label: "Cancelled", className: "bg-stat-red/10 text-stat-red border-stat-red/20" },
  failed: { label: "Failed", className: "bg-stat-red/10 text-stat-red border-stat-red/20" },
  active: { label: "Active", className: "bg-stat-green/10 text-stat-green border-stat-green/20" },
  inactive: { label: "Inactive", className: "bg-muted text-muted-foreground border-muted-foreground/20" },
  pickup: { label: "Pickup", className: "bg-stat-green/10 text-stat-green border-stat-green/20" },
  delivery: { label: "Delivery", className: "bg-stat-green/10 text-stat-green border-stat-green/20" },
  transfer: { label: "Transfer", className: "bg-stat-yellow/10 text-stat-yellow border-stat-yellow/20" },
  supply: { label: "Supply", className: "bg-stat-red/10 text-stat-red border-stat-red/20" },
  air: { label: "Air", className: "bg-stat-blue/10 text-stat-blue border-stat-blue/20" },
  sea: { label: "Sea", className: "bg-stat-blue/10 text-stat-blue border-stat-blue/20" },
  // Roles
  admin: { label: "Admin", className: "bg-stat-red/10 text-stat-red border-stat-red/20" },
  staff: { label: "Staff", className: "bg-stat-blue/10 text-stat-blue border-stat-blue/20" },
  branch_manager: { label: "Warehouse Manager", className: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  customer: { label: "Customer", className: "bg-stat-green/10 text-stat-green border-stat-green/20" },
  driver: { label: "Driver", className: "bg-stat-yellow/10 text-stat-yellow border-stat-yellow/20" },
  // Payment
  payment: { label: "Payment", className: "bg-stat-green/10 text-stat-green border-stat-green/20" },
  refund: { label: "Refund", className: "bg-stat-red/10 text-stat-red border-stat-red/20" },
  wallet_topup: { label: "Wallet Top-up", className: "bg-stat-blue/10 text-stat-blue border-stat-blue/20" },
  wallet_deduction: { label: "Wallet Deduction", className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
};

export const StatusBadge = ({ status, label, className }: StatusBadgeProps) => {
  const normalizedStatus = status.toLowerCase();
  const config = statusConfig[normalizedStatus] || {
    label: status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
  };

  const displayLabel = label || config.label;

  return (
    <Badge
      variant="outline"
      className={cn("font-medium border text-[11px] capitalize", config.className, className)}
    >
      {displayLabel}
    </Badge>
  );
};
