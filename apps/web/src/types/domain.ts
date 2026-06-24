export type InvoiceStatus =
  | "pending"
  | "under_review"
  | "submitted_to_genlayer"
  | "approved"
  | "rejected"
  | "escalated";

export type RiskBand = "low" | "medium" | "high";

export type GenLayerStatus = "not_submitted" | "pending" | "confirmed" | "failed";

export interface RiskFactor {
  factor: string;
  weight: number;
  detail: string;
}

export interface AnomalyFlag {
  type: string;
  severity: "low" | "medium" | "high";
  detail: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Vendor {
  id: string;
  name: string;
  taxId: string;
  email: string;
  status: "active" | "under_review" | "blocked";
  reputationScore: number;
  totalInvoices: number;
  flaggedInvoices: number;
  avgPriceVariancePct: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  vendorName: string;
  poNumber?: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  preliminaryRiskScore: number;
  finalRiskScore?: number;
  anomalyFlags: AnomalyFlag[];
  riskFactors?: RiskFactor[];
  reasoning?: string;
  genLayerStatus: GenLayerStatus;
  genLayerTxHash?: string;
  lineItems: InvoiceLineItem[];
  submittedAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  onChain: boolean;
}

export function riskBand(score: number): RiskBand {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}
