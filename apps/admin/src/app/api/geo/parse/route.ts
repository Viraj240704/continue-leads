import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { parseSpreadsheet } from "@/lib/spreadsheet";
import { GEO_BY_STATE, findCity } from "@/lib/geo-data";

// Parse an uploaded geography template (CSV/XLSX with state, city, zip columns)
// into a validated selection the wizard can apply.
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") return Response.json({ ok: false, error: "no file" }, { status: 400 });

  let sheet;
  try { sheet = await parseSpreadsheet(file as File); }
  catch (e: any) { return Response.json({ ok: false, error: `could not read file: ${e?.message ?? "parse error"}` }, { status: 400 }); }

  if (!sheet.headers.includes("state") || !sheet.headers.includes("city")) {
    return Response.json({ ok: false, error: "template must have 'state' and 'city' columns (zip optional)" }, { status: 400 });
  }

  const states = new Set<string>(), cities = new Set<string>(), zips = new Set<string>();
  let matched = 0, unmatched = 0;
  for (const row of sheet.rows) {
    const code = (row.state ?? "").toUpperCase();
    const city = row.city ?? "";
    const zip = (row.zip ?? "").trim();
    const st = GEO_BY_STATE[code];
    const cityRec = st ? findCity(code, city) : null;
    if (!st || !cityRec) { unmatched++; continue; }
    matched++;
    states.add(code);
    cities.add(`${code}|${cityRec.name}`);
    if (zip && cityRec.zips.includes(zip)) zips.add(zip);
  }

  return Response.json({
    ok: true, matched, unmatched,
    selection: { states: [...states], cities: [...cities], zips: [...zips] },
  });
}
