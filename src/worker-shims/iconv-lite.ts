import { Buffer } from 'node:buffer';

export interface IconvOptions {
  stripBOM?: boolean;
  addBOM?: boolean;
  defaultEncoding?: string;
}

const UTF16LE_BOM = Buffer.from([0xff, 0xfe]);
const UTF16BE_BOM = Buffer.from([0xfe, 0xff]);
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function normalizeEncoding(encoding?: string): string {
  if (encoding === undefined || encoding === null) return '';
  const clean = String(encoding).trim().toLowerCase();
  if (!clean) return '';

  if (clean === 'utf8' || clean === 'utf-8' || clean === 'unicode-1-1-utf-8' || clean === 'csutf8') {
    return 'utf-8';
  }
  if (clean === 'utf16le' || clean === 'utf-16le' || clean === 'ucs2' || clean === 'ucs-2' || clean === 'utf16' || clean === 'utf-16') {
    return 'utf-16le';
  }
  if (clean === 'utf16be' || clean === 'utf-16be') {
    return 'utf-16be';
  }
  if (
    clean === 'latin1' ||
    clean === 'iso-8859-1' ||
    clean === 'iso8859-1' ||
    clean === 'iso_8859-1' ||
    clean === 'l1' ||
    clean === 'binary' ||
    clean === 'windows-1252' ||
    clean === 'cp1252' ||
    clean === 'win1252'
  ) {
    return 'iso-8859-1';
  }
  if (clean === 'ascii' || clean === 'us-ascii') {
    return 'ascii';
  }
  if (clean === 'windows-1256' || clean === 'cp1256' || clean === 'win1256') {
    return 'windows-1256';
  }
  return clean;
}

function unknownEncodingError(encoding?: string): Error {
  return new Error(`Encoding not recognized: '${encoding ?? ''}'`);
}

function decodeAsciiBytes(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    out += b < 0x80 ? String.fromCharCode(b) : '\uFFFD';
  }
  return out;
}

function encodeAsciiString(str: string): Buffer {
  const out = Buffer.allocUnsafe(str.length);
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    out[i] = code < 0x80 ? code : 0x3f;
  }
  return out;
}

const WIN1252_REVERSE: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function encodeLatin1OrWin1252(str: string): Buffer {
  const out = Buffer.allocUnsafe(str.length);
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code <= 0xff) {
      out[i] = code;
    } else if (code in WIN1252_REVERSE) {
      out[i] = WIN1252_REVERSE[code];
    } else {
      out[i] = 0x3f;
    }
  }
  return out;
}

export function encodingExists(encoding?: string): boolean {
  const norm = normalizeEncoding(encoding);
  if (!norm) return false;
  if (norm === 'utf-8' || norm === 'utf-16le' || norm === 'utf-16be' || norm === 'iso-8859-1' || norm === 'ascii') {
    return true;
  }
  try {
    new TextDecoder(norm);
    return true;
  } catch {
    return false;
  }
}

export function decode(buf: Buffer | Uint8Array, encoding?: string, options?: IconvOptions): string {
  const norm = normalizeEncoding(encoding);
  if (!norm) {
    throw unknownEncodingError(encoding);
  }
  const bytes = buf instanceof Uint8Array ? buf : Buffer.from(buf);
  const ignoreBOM = options?.stripBOM === false;

  if (norm === 'ascii') {
    return decodeAsciiBytes(bytes);
  }
  if (norm === 'iso-8859-1') {
    return new TextDecoder('windows-1252', { ignoreBOM: true }).decode(bytes);
  }
  try {
    return new TextDecoder(norm, { ignoreBOM }).decode(bytes);
  } catch {
    throw unknownEncodingError(encoding);
  }
}

export function encode(str: string, encoding?: string, options?: IconvOptions): Buffer {
  const norm = normalizeEncoding(encoding);
  if (!norm) {
    throw unknownEncodingError(encoding);
  }
  const addBOM = Boolean(options?.addBOM);

  if (norm === 'utf-8') {
    const body = Buffer.from(str, 'utf8');
    return addBOM ? Buffer.concat([UTF8_BOM, body]) : body;
  }
  if (norm === 'utf-16le') {
    const body = Buffer.from(str, 'utf16le');
    return addBOM ? Buffer.concat([UTF16LE_BOM, body]) : body;
  }
  if (norm === 'utf-16be') {
    const body = Buffer.from(str, 'utf16le');
    body.swap16();
    return addBOM ? Buffer.concat([UTF16BE_BOM, body]) : body;
  }
  if (norm === 'ascii') {
    return encodeAsciiString(str);
  }
  if (norm === 'iso-8859-1') {
    return encodeLatin1OrWin1252(str);
  }
  throw unknownEncodingError(encoding);
}

export function getDecoder(encoding?: string, options?: IconvOptions) {
  const norm = normalizeEncoding(encoding);
  if (!norm || !encodingExists(norm)) {
    throw unknownEncodingError(encoding);
  }

  if (norm === 'ascii') {
    return {
      write(buf: Buffer | Uint8Array): string {
        if (!buf || buf.length === 0) return '';
        const bytes = buf instanceof Uint8Array ? buf : Buffer.from(buf);
        return decodeAsciiBytes(bytes);
      },
      end(): string {
        return '';
      },
    };
  }

  const ignoreBOM = options?.stripBOM === false;
  const decoderEncoding = norm === 'iso-8859-1' ? 'windows-1252' : norm;
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(decoderEncoding, { ignoreBOM });
  } catch {
    throw unknownEncodingError(encoding);
  }

  return {
    write(buf: Buffer | Uint8Array): string {
      if (!buf || buf.length === 0) return '';
      const bytes = buf instanceof Uint8Array ? buf : Buffer.from(buf);
      return decoder.decode(bytes, { stream: true });
    },
    end(): string {
      return decoder.decode();
    },
  };
}

export function getEncoder(encoding?: string, options?: IconvOptions) {
  const norm = normalizeEncoding(encoding);
  if (!norm) {
    throw unknownEncodingError(encoding);
  }
  // Validate encoding upfront so unsupported encodings fail immediately
  encode('', encoding, options);
  let bomWritten = false;
  return {
    write(str: string): Buffer {
      const shouldAddBom = Boolean(options?.addBOM) && !bomWritten;
      bomWritten = true;
      return encode(str, encoding, { ...options, addBOM: shouldAddBom });
    },
    end(): Buffer {
      return Buffer.alloc(0);
    },
  };
}

export const supportsStreams = false;

const iconvShim = {
  encodingExists,
  decode,
  encode,
  getDecoder,
  getEncoder,
  supportsStreams,
};

export default iconvShim;
