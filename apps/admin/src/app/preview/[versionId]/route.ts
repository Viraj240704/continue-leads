import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { getStorage } from "@/lib/adapters/storage";

// Private, authenticated preview of a specific page version (spec P8).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ versionId: string }> }) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { versionId } = await ctx.params;

  const uri = await withTenant(user.tenantId, async (c) => {
    const { rows } = await c.query(`SELECT render_uri FROM page_versions WHERE id = $1`, [versionId]);
    return rows[0]?.render_uri as string | undefined;
  });
  if (!uri) return new Response("Preview not found", { status: 404 });

  const html = await getStorage().get(uri);
  if (!html) return new Response("Rendered artifact missing", { status: 404 });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } });
}
