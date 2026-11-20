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
  const safeSheet = sheetName.slice(0, 31).replace(/[\\/*?:[\]]/g, '_') || 'Export';
  const sanitizedRows = rows.map((row) =>
    headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'string' && /^[=+\-@\t\r]/.test(val)) return `'${val}`;
      return val;
    })
  );

  try {
    const ExcelJS = await loadExcelJS();
    if (ExcelJS?.Workbook) {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(safeSheet);
      worksheet.addRow(headers);

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF092D52' },
      };

      for (const vals of sanitizedRows) {
        worksheet.addRow(vals);
      }

      const arrayBuffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(arrayBuffer);
    }
  } catch {
    // Fall back to pure-JS SheetJS writer (e.g., edge runtimes)
  }

  const XLSX = await import('xlsx');
  const utils = XLSX.utils ?? XLSX.default?.utils;
  const write = XLSX.write ?? XLSX.default?.write;
  const wb = utils.book_new();
  const ws = utils.aoa_to_sheet([headers, ...sanitizedRows]);
  utils.book_append_sheet(wb, ws, safeSheet);
  return Buffer.from(write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array);
}

function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/, 1)[0] || '';
  const candidates = [',', ';', '\t'] as const;
  let best = ',';
  let bestCount = 0;
  for (const delim of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i += 1) {
      const ch = firstLine[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === delim && !inQuotes) count += 1;
    }
    if (count > bestCount) {
      bestCount = count;
      best = delim;
    }
  }
  return best;
}

function decodeTextBuffer(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.slice(2).toString('utf16le');
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.allocUnsafe(buffer.length - 2);
    for (let i = 2; i + 1 < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return swapped.toString('utf16le');
  }
  return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

function formatSpreadsheetCell(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return '';
    const y = cell.getUTCFullYear();
    const m = String(cell.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cell.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof cell === 'object' && 'result' in (cell as Record<string, unknown>)) {
    return formatSpreadsheetCell((cell as { result?: unknown }).result);
  }
  if (typeof cell === 'object' && 'text' in (cell as Record<string, unknown>)) {
    return String((cell as { text?: unknown }).text ?? '').trim();
  }
  return String(cell).trim();
}

export function parseCsvText(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(cleaned);
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
    } else if (ch === delimiter && !inQuotes) {
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
    const rowCells = values.slice(1).map((cell) => formatSpreadsheetCell(cell));
    if (rowCells.some((c) => c !== '')) {
      matrix.push(rowCells);
    }
  });
  return matrix;
}

export async function parseSpreadsheetBuffer(
  buffer: Buffer,
  fileType?: string,
  fileName?: string
): Promise<string[][]> {
  const extFromName = fileName?.split('.').pop()?.toLowerCase().trim() || '';
  const hint = (extFromName || fileType || '').toLowerCase().trim();

  if (hint === 'csv' || hint === 'tsv' || hint === 'txt') {
    const text = decodeTextBuffer(buffer);
    return parseCsvText(text);
  }

  try {
    const XLSX = await import('xlsx');
    const readWorkbook = XLSX.read ?? XLSX.default?.read;
    const sheetToJson = XLSX.utils?.sheet_to_json ?? XLSX.default?.utils?.sheet_to_json;

    if (readWorkbook && sheetToJson) {
      const workbook = readWorkbook(buffer, {
        type: 'buffer',
        cellDates: true,
        raw: false,
      });
      const firstSheetName = workbook.SheetNames[0];
      if (firstSheetName) {
        const sheet = workbook.Sheets[firstSheetName];
        const rawMatrix = sheetToJson(sheet, {
          header: 1,
          defval: '',
          blankrows: false,
          raw: false,
        }) as unknown[][];
        const normalized = rawMatrix
          .map((r) => r.map((cell) => formatSpreadsheetCell(cell)))
          .filter((r) => r.some((c) => c !== ''));
        if (normalized.length > 0) {
          return normalized;
        }
      }
    }
  } catch {
    // Fall back to ExcelJS or text parser below
  }

  try {
    const excelRows = await parseXlsxBuffer(buffer);
    if (excelRows.length > 0) return excelRows;
  } catch {
    // Fall back to delimited text
  }

  return parseCsvText(decodeTextBuffer(buffer));
}

