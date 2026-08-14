import { getSession } from "@/lib/auth";
import { GEO } from "@/lib/geo-data";

// Downloadable geography selection template (CSV). Rows the customer keeps become
// their targeted areas; leave the zip column blank to target the whole city.
export async function GET() {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const lines = ["state,city,zip"];
  // Seed with a couple of example rows so the format is obvious.
  const sample = GEO[0]!;
  lines.push(`${sample.code},${sample.cities[0]!.name},${sample.cities[0]!.zips[0]}`);
  lines.push(`${sample.code},${sample.cities[1]!.name},`);
  const csv = lines.join("\n") + "\n";

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="geography-template.csv"',
    },
  });
}
