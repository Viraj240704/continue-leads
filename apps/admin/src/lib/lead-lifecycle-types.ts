// Client-safe lifecycle constants/types (no server-only imports).
export type Lifecycle = "new" | "validated" | "sold" | "rejected" | "returned";

export const LIFECYCLE_ORDER: Lifecycle[] = ["new", "validated", "sold", "rejected", "returned"];
export const LIFECYCLE_LABELS: Record<Lifecycle, string> = {
  new: "New", validated: "Validated", sold: "Sold", rejected: "Rejected", returned: "Returned",
};
export const LIFECYCLE_TONE: Record<Lifecycle, string> = {
  new: "bg-info/12 text-info",
  validated: "bg-primary/12 text-primary",
  sold: "bg-ok/12 text-ok",
  rejected: "bg-bad/12 text-bad",
  returned: "bg-warn/15 text-warn",
};

export function deriveLifecycle(row: {
  validation_status?: string | null; sale_status?: string | null;
  returned_at?: string | null; rejected_at?: string | null;
}): Lifecycle {
  if (row.returned_at) return "returned";
  if (row.sale_status === "sold") return "sold";
  if (row.rejected_at || row.validation_status === "invalid" || row.sale_status === "rejected") return "rejected";
  if (row.validation_status === "valid") return "validated";
  return "new";
}

export interface LeadFilters {
  q?: string; status?: Lifecycle; brandId?: string; category?: string;
  from?: string; to?: string; page?: number; pageSize?: number;
}
export interface LeadRow {
  id: string; brandId: string; brandName: string; category: string;
  source: string; lifecycle: Lifecycle; priceUsd: number; createdAt: string;
}
export interface LeadPage { rows: LeadRow[]; total: number; page: number; pageSize: number; brands: { id: string; name: string }[]; categories: string[] }
