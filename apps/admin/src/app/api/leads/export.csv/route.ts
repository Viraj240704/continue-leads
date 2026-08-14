import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { soldLeadsCsv } from "@/lib/csv";

// Accounting export of sold leads as CSV. Optional ?buyerId=&from=&to= filters.
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const filters = {
    buyerId: url.searchParams.get("buyerId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  };
  const csv = await withTenant(user.tenantId, (c) => soldLeadsCsv(c, filters));
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="sold-leads-${stamp}.csv"`,
    },
  });
}
