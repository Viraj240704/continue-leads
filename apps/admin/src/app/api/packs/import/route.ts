import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { parseSpreadsheet } from "@/lib/spreadsheet";
import { importPacks } from "@/lib/packs-import";

// Import product packs from an uploaded Excel/CSV (columns: product, service_name, hint).
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") return Response.json({ ok: false, error: "no file" }, { status: 400 });

  try {
    const sheet = await parseSpreadsheet(file as File);
    const result = await withTenant(user.tenantId, (c) => importPacks(c, user.tenantId, sheet));
    return Response.json({ ok: true, ...result });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "import failed" }, { status: 400 });
  }
}
