import { NextRequest } from "next/server";
import { getStorage, storageKeys } from "@/lib/adapters/storage";

// Public delivery of the PUBLISHED static site from the live prefix (mirrors
// CloudFront-over-S3). Only pages promoted by the publisher exist here.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ brandSlug: string; path?: string[] }> }) {
  const { brandSlug, path = [] } = await ctx.params;
  const storage = getStorage();
  const joined = path.join("/");

  if (joined === "sitemap.xml") {
    const xml = await storage.get(storageKeys.sitemap(brandSlug));
    return xml
      ? new Response(xml, { headers: { "content-type": "application/xml" } })
      : new Response("Not found", { status: 404 });
  }
  if (joined === "robots.txt") {
    const txt = await storage.get(storageKeys.robots(brandSlug));
    return txt
      ? new Response(txt, { headers: { "content-type": "text/plain" } })
      : new Response("User-agent: *\nAllow: /\n", { headers: { "content-type": "text/plain" } });
  }

  const urlPath = "/" + joined; // "" -> "/"
  const key = storageKeys.live(brandSlug, urlPath === "/" ? "/" : urlPath);
  const html = await storage.get(key);
  if (!html) {
    return new Response(
      `<!doctype html><meta charset=utf-8><title>404</title><body style="font-family:sans-serif;padding:40px">
       <h1>404 — not published</h1><p>No live page at <code>${urlPath}</code> for <b>${brandSlug}</b>.
       Pages appear here only after the publisher promotes them.</p></body>`,
      { status: 404, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
