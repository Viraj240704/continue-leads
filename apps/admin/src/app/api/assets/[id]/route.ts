import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { getAsset } from "@/lib/assets";
import { getStorage } from "@/lib/adapters/storage";

// Serve a binary brand asset (logo/image) to authenticated operators for admin display.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;

  const asset = await withTenant(user.tenantId, (c) => getAsset(c, id));
  if (!asset?.storage_key) return new Response("Not found", { status: 404 });
  const bytes = await getStorage().getBytes(asset.storage_key);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": asset.content_type, "cache-control": "private, max-age=60" },
  });
}
