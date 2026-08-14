import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { getBrand } from "@/lib/sites";
import { createAsset } from "@/lib/assets";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB per asset
const ALLOWED_KINDS = new Set(["logo", "image", "document", "about", "other"]);

// Upload a brand asset (logo / image / document) or store supplied text (about-us).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id: brandId } = await ctx.params;

  const form = await req.formData();
  const kind = String(form.get("kind") ?? "other");
  if (!ALLOWED_KINDS.has(kind)) return Response.json({ ok: false, error: "invalid kind" }, { status: 400 });
  const text = String(form.get("text") ?? "");
  const file = form.get("file");

  let bytes: Buffer | undefined;
  let filename = String(form.get("filename") ?? "");
  let contentType = "text/plain";
  if (file && typeof file !== "string") {
    if (file.size > MAX_BYTES) return Response.json({ ok: false, error: "file too large (max 5MB)" }, { status: 400 });
    bytes = Buffer.from(await file.arrayBuffer());
    filename = file.name;
    contentType = file.type || "application/octet-stream";
    if (kind === "logo" && !contentType.startsWith("image/")) return Response.json({ ok: false, error: "logo must be an image" }, { status: 400 });
  } else if (!text.trim()) {
    return Response.json({ ok: false, error: "provide a file or text" }, { status: 400 });
  }

  const result = await withTenant(user.tenantId, async (c) => {
    const brand = await getBrand(c, brandId);
    if (!brand) return null;
    return createAsset(c, {
      tenantId: user.tenantId, brandId, brandSlug: brand.slug,
      kind: kind as any, filename, contentType, bytes, textContent: text,
    });
  });
  if (!result) return Response.json({ ok: false, error: "brand not found" }, { status: 404 });
  return Response.json({ ok: true, asset: { id: result.id, kind: result.kind, filename: result.filename } });
}
