import { Badge } from "@/components/ui/badge";
import type { GenLayerStatus, InvoiceStatus } from "@/types/domain";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  under_review: "bg-primary/10 text-primary border-primary/20",
  submitted_to_genlayer: "bg-genlayer/10 text-genlayer border-genlayer/20 animate-pulse",
  approved: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  escalated: "bg-warning/10 text-warning border-warning/20",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  pending: "Pending",
  under_review: "Under Review",
  submitted_to_genlayer: "Validating",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
};

export function StatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status], className)}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

const GL_STYLES: Record<GenLayerStatus, string> = {
  not_submitted: "bg-muted text-muted-foreground border-border",
  pending: "bg-genlayer/10 text-genlayer border-genlayer/20 animate-pulse",
  confirmed: "bg-genlayer/10 text-genlayer border-genlayer/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
};

const GL_LABEL: Record<GenLayerStatus, string> = {
  not_submitted: "Not submitted",
  pending: "Validating on-chain",
  confirmed: "On-chain confirmed",
  failed: "Validation failed",
};

export function GenLayerStatusBadge({ status, className }: { status: GenLayerStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(GL_STYLES[status], className)}>
      {GL_LABEL[status]}
    </Badge>
  );
}
