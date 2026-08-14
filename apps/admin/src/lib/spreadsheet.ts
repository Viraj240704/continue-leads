import "server-only";

// Parse an uploaded CSV or XLSX into rows of string cells (first row = headers).
// Returns { headers, rows } where each row is an object keyed by lowercased header.
export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
}

export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) return parseXlsx(await file.arrayBuffer());
  return parseCsv(await file.text());
}

function toObjects(matrix: string[][]): ParsedSheet {
  if (matrix.length === 0) return { headers: [], rows: [] };
  const headers = matrix[0]!.map((h) => h.trim().toLowerCase());
  const rows = matrix.slice(1)
    .filter((r) => r.some((c) => c && c.trim() !== ""))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { headers, rows };
}

// Minimal RFC-4180-ish CSV parser (handles quotes + embedded commas/newlines).
function parseCsv(text: string): ParsedSheet {
  const matrix: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); matrix.push(row); row = []; cell = ""; }
    else if (ch === "\r") { /* skip */ }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); matrix.push(row); }
  return toObjects(matrix);
}

async function parseXlsx(buf: ArrayBuffer): Promise<ParsedSheet> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };
  const matrix: string[][] = [];
  ws.eachRow((r) => {
    const cells: string[] = [];
    // exceljs is 1-indexed; values[0] is unused.
    const values = r.values as any[];
    for (let i = 1; i < values.length; i++) {
      const v = values[i];
      cells.push(v == null ? "" : String(v.text ?? v.result ?? v));
    }
    matrix.push(cells);
  });
  return toObjects(matrix);
}
