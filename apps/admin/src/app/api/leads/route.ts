import { NextRequest } from "next/server";
import { captureLead } from "@/lib/leads";

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
     <title>${title}</title>
     <body style="font-family:system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;margin:0;background:#f5f6f8;color:#101828">
     <div style="max-width:440px;padding:32px;text-align:center;background:#fff;border:1px solid #e4e7ec;border-radius:12px;box-shadow:0 8px 24px rgba(16,24,40,0.08)">
       <h1 style="margin:0 0 8px;font-size:20px">${title}</h1><p style="color:#475467">${body}</p>
       <a href="javascript:history.back()" style="color:#4f46e5;font-weight:600;text-decoration:none">← Go back</a>
     </div></body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

// Lead capture endpoint (spec P10): honeypot, rate limit, UTM + consent capture,
// encrypted PII, exactly-once via dedupe key. Stable contract for Phase 2 routing.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const get = (k: string) => String(form.get(k) ?? "");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  const url = new URL(req.url);
  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const v = url.searchParams.get(k);
    if (v) utm[k] = v;
  }

  const res = await captureLead({
    brandSlug: get("brand"),
    name: get("name"),
    phone: get("phone"),
    email: get("email"),
    message: get("message"),
    consent: form.get("consent") != null,
    honeypot: get("company_website"),
    utm,
    pagePath: req.headers.get("referer") ? new URL(req.headers.get("referer")!).pathname : "",
    ip,
    userAgent: req.headers.get("user-agent") ?? "",
  });

  if (!res.ok) {
    const reasons: Record<string, string> = {
      spam: "Submission blocked.",
      consent_required: "Please agree to be contacted before submitting.",
      missing_fields: "Name and phone are required.",
      rate_limited: "Too many submissions. Please try again later.",
      unknown_brand: "This form is not configured correctly.",
    };
    return page("We couldn't submit that", reasons[res.reason] ?? "Please try again.", 400);
  }
  return page(
    res.deduped ? "You're already on our list" : "Thank you!",
    res.deduped ? "We already received your request today and will be in touch." : "Your request was received. We'll reach out within one business day."
  );
}
