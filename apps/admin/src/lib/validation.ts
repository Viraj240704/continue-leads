// Lead validation, quality scoring and price suggestion. Pure + deterministic so it
// runs at capture time and can be re-run on demand.

const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "trashmail.com", "yopmail.com", "sharklasers.com", "getnada.com",
]);

export interface LeadCheck { key: string; ok: boolean; note: string }
export interface ValidationResult {
  validationStatus: "valid" | "invalid" | "review";
  validation: { checks: LeadCheck[]; digits: number };
  qualityScore: number; // 0..100
  priceUsd: number;
}

function digitsOf(s: string) { return (s.match(/\d/g) ?? []).length; }

export function validateLeadData(input: {
  name: string; phone: string; email?: string; message?: string; utm?: Record<string, string>;
}): ValidationResult {
  const checks: LeadCheck[] = [];
  const name = (input.name ?? "").trim();
  const phone = (input.phone ?? "").trim();
  const email = (input.email ?? "").trim();
  const message = (input.message ?? "").trim();

  // Name
  const nameOk = name.length >= 2 && /[aeiou]/i.test(name) && !/^(.)\1+$/.test(name.replace(/\s/g, ""));
  checks.push({ key: "name", ok: nameOk, note: nameOk ? "Looks like a real name" : "Name missing or implausible" });

  // Phone (US: 10 digits, or 11 starting with 1)
  const pd = digitsOf(phone);
  const phoneOk = pd === 10 || (pd === 11 && phone.replace(/\D/g, "").startsWith("1"));
  checks.push({ key: "phone", ok: phoneOk, note: phoneOk ? `${pd}-digit phone` : `Invalid phone (${pd} digits)` });

  // Email (optional but scored)
  let emailOk = true, disposable = false;
  if (email) {
    emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    disposable = emailOk && DISPOSABLE.has(email.split("@")[1]?.toLowerCase() ?? "");
    checks.push({ key: "email", ok: emailOk && !disposable, note: !emailOk ? "Malformed email" : disposable ? "Disposable email domain" : "Valid email" });
  } else {
    checks.push({ key: "email", ok: true, note: "No email provided (optional)" });
  }

  // Message / intent
  const hasMessage = message.length >= 8;
  checks.push({ key: "message", ok: hasMessage, note: hasMessage ? "Includes project detail" : "No message detail" });

  // Attribution
  const attributed = !!(input.utm && Object.keys(input.utm).length);
  checks.push({ key: "attribution", ok: attributed, note: attributed ? "UTM source captured" : "No UTM attribution" });

  // Score (weighted). Phone is the critical field.
  let score = 0;
  if (phoneOk) score += 45;
  if (nameOk) score += 20;
  if (email && emailOk && !disposable) score += 15;
  if (hasMessage) score += 12;
  if (attributed) score += 8;

  // Status
  let validationStatus: ValidationResult["validationStatus"];
  if (!phoneOk || !nameOk || disposable) validationStatus = "invalid";
  else if (score >= 70) validationStatus = "valid";
  else validationStatus = "review";

  // Suggested price scales with quality; invalid leads are not saleable.
  const priceUsd = validationStatus === "invalid" ? 0 : round(8 + score * 0.4);

  return { validationStatus, validation: { checks, digits: pd }, qualityScore: score, priceUsd };
}

function round(n: number) { return Math.round(n * 100) / 100; }
