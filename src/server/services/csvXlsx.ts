async function loadExcelJS() {
  const mod = await import('exceljs');
  return mod.default ?? (mod as unknown as typeof import('exceljs'));
}

export interface ImportReason {
  row: number;
  reason: string;
}

export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  imported: number;
  rejected: number;
  reasons: ImportReason[];
}

export function sanitizeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  // Mitigate spreadsheet formula injection when exporting CSV
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function serializeToUtf8Csv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(',');
  const dataLines = rows.map((row) => headers.map((h) => sanitizeCsvCell(row[h])).join(','));
  return `\uFEFF${[headerLine, ...dataLines].join('\r\n')}`;
}

export async function serializeToXlsxBuffer(
  sheetName: string,
  headers: string[],
  rows: Array<Record<string, unknown>>
): Promise<Buffer> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const safeSheet = sheetName.slice(0, 31).replace(/[\\/*?:[\]]/g, '_') || 'Export';
  const worksheet = workbook.addWorksheet(safeSheet);
  worksheet.addRow(headers);

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF092D52' },
  };

  for (const row of rows) {
    worksheet.addRow(
      headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && /^[=+\-@\t\r]/.test(val)) return `'${val}`;
        return val;
      })
    );
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function parseCsvText(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((v) => v.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  row.push(cell);
  if (row.some((v) => v.trim() !== '')) {
    rows.push(row);
  }
  return rows;
}

export async function parseXlsxBuffer(buffer: Buffer): Promise<string[][]> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const matrix: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as Array<unknown>;
    // ExcelJS row.values is 1-indexed
    const rowCells = values.slice(1).map((cell) => {
      if (cell === null || cell === undefined) return '';
      if (cell instanceof Date) {
        return cell.toISOString().slice(0, 10);
      }
      if (typeof cell === 'object' && 'result' in (cell as Record<string, unknown>)) {
        return String((cell as { result?: unknown }).result ?? '');
      }
      if (typeof cell === 'object' && 'text' in (cell as Record<string, unknown>)) {
        return String((cell as { text?: unknown }).text ?? '');
      }
      return String(cell).trim();
    });
    if (rowCells.some((c) => c !== '')) {
      matrix.push(rowCells);
    }
  });
  return matrix;
}
