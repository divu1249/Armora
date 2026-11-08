/**
 * Text normalization module:
 * - NFKC normalization
 * - Strip zero-width & invisible control characters
 * - Whitespace collapse
 * - Bounded base64 decoding (capped size & depth)
 * - Original offset preservation
 */

export interface NormalizedResult {
  original: string;
  normalized: string;
  // Map index in normalized string back to approximate index in original string
  offsetMap: number[];
  base64DecodedSubstrings: Array<{
    start: number;
    end: number;
    decoded: string;
  }>;
}

const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const BASE64_CANDIDATE_REGEX = /(?:[A-Za-z0-9+/]{4}){4,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;

export function normalizeContent(input: string): NormalizedResult {
  if (!input) {
    return {
      original: '',
      normalized: '',
      offsetMap: [],
      base64DecodedSubstrings: [],
    };
  }

  // 1. NFKC normalization
  const nfkc = input.normalize('NFKC');

  // 2. Strip zero-width and invisible control characters while building offset map
  const charArray: string[] = [];
  const offsetMap: number[] = [];

  for (let i = 0; i < nfkc.length; i++) {
    const char = nfkc[i];
    if (!ZERO_WIDTH_REGEX.test(char)) {
      charArray.push(char);
      offsetMap.push(i);
    }
    // reset regex state
    ZERO_WIDTH_REGEX.lastIndex = 0;
  }

  const cleaned = charArray.join('');

  // 3. Bounded base64 inspection (cap size 8192 bytes, depth 1)
  const base64DecodedSubstrings: Array<{ start: number; end: number; decoded: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = BASE64_CANDIDATE_REGEX.exec(cleaned)) !== null) {
    const candidate = match[0];
    if (candidate.length < 16 || candidate.length > 8192) continue;

    try {
      const decodedBuffer = Buffer.from(candidate, 'base64');
      // check if it's printable UTF-8
      const decodedText = decodedBuffer.toString('utf-8');
      const isPrintable = /^[\x20-\x7E\s\u00A0-\uFFFF]+$/.test(decodedText);
      if (isPrintable && decodedText.trim().length > 4) {
        base64DecodedSubstrings.push({
          start: match.index,
          end: match.index + candidate.length,
          decoded: decodedText,
        });
      }
    } catch {
      // not valid base64
    }
  }

  return {
    original: input,
    normalized: cleaned,
    offsetMap,
    base64DecodedSubstrings,
  };
}

export function mapOffsetToOriginal(offsetMap: number[], normalizedOffset: number, originalLength: number): number {
  if (offsetMap.length === 0) return 0;
  if (normalizedOffset >= offsetMap.length) return originalLength;
  if (normalizedOffset < 0) return 0;
  return offsetMap[normalizedOffset] ?? normalizedOffset;
}
