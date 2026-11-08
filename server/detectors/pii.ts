import crypto from 'crypto';
import { Finding, Segment } from '../types.ts';
import { normalizeContent, mapOffsetToOriginal } from '../normalization.ts';

const AUDIT_SALT_SECRET = process.env.AUDIT_SALT_SECRET || 'dev_audit_salt_secret_key_llm_firewall_2026';

/**
 * Verhoeff algorithm tables for Aadhaar checksum validation
 */
// The multiplication table d
const VERHOEFF_D: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

// The permutation table p
const VERHOEFF_P: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

// The inverse table inv
const VERHOEFF_INV: number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/**
 * Validates whether a 12-digit string satisfies Verhoeff checksum.
 */
export function validateVerhoeff(str: string): boolean {
  if (!/^\d{12}$/.test(str)) return false;
  // Aadhaar rule: cannot start with 0 or 1
  if (str[0] === '0' || str[0] === '1') return false;

  let c = 0;
  const digits = str.split('').map(Number).reverse();

  for (let i = 0; i < digits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits[i]]];
  }

  return c === 0;
}

/**
 * Generate a valid Verhoeff checksum digit for an 11-digit base.
 */
export function generateVerhoeff(str11: string): string {
  let c = 0;
  const digits = str11.split('').map(Number).reverse();
  for (let i = 0; i < digits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[(i + 1) % 8][digits[i]]];
  }
  return str11 + VERHOEFF_INV[c].toString();
}

/**
 * Luhn algorithm for credit card checksum validation
 */
export function validateLuhn(str: string): boolean {
  const clean = str.replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) return false;

  let sum = 0;
  let alternate = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let n = parseInt(clean[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/**
 * HMAC-SHA256 with server secret to hash PII without revealing raw data
 */
export function hashPiiValue(value: string): string {
  return crypto.createHmac('sha256', AUDIT_SALT_SECRET).update(value.trim()).digest('hex');
}

export function detectPiiAndSecrets(segment: Segment): Finding[] {
  const norm = normalizeContent(segment.content);
  const text = norm.normalized;
  const findings: Finding[] = [];

  // 1. Aadhaar detection (12 digits, optionally formatted as XXXX XXXX XXXX or XXXX-XXXX-XXXX)
  const aadhaarRegex = /\b([2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4})\b/g;
  let match: RegExpExecArray | null;

  while ((match = aadhaarRegex.exec(text)) !== null) {
    const rawNumber = match[1].replace(/[\s-]/g, '');
    if (validateVerhoeff(rawNumber)) {
      const startNorm = match.index;
      const endNorm = match.index + match[0].length;
      findings.push({
        id: `fnd_aadhaar_${Date.now()}_${findings.length}`,
        detector: 'PII Detector (Verhoeff Aadhaar)',
        category: 'PII_AADHAAR',
        severity: 'CRITICAL',
        confidence: 0.99,
        segmentId: segment.id,
        start: mapOffsetToOriginal(norm.offsetMap, startNorm, segment.content.length),
        end: mapOffsetToOriginal(norm.offsetMap, endNorm, segment.content.length),
        reason: 'Valid Aadhaar number detected (Verhoeff checksum verified)',
        evidenceHash: hashPiiValue(rawNumber),
      });
    }
  }

  // 2. PAN format (5 letters, 4 digits, 1 letter)
  const panRegex = /\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/g;
  while ((match = panRegex.exec(text)) !== null) {
    const pan = match[1];
    const startNorm = match.index;
    const endNorm = match.index + pan.length;
    findings.push({
      id: `fnd_pan_${Date.now()}_${findings.length}`,
      detector: 'PII Detector (Income Tax PAN)',
      category: 'PII_PAN',
      severity: 'HIGH',
      confidence: 0.95,
      segmentId: segment.id,
      start: mapOffsetToOriginal(norm.offsetMap, startNorm, segment.content.length),
      end: mapOffsetToOriginal(norm.offsetMap, endNorm, segment.content.length),
      reason: 'Permanent Account Number (PAN) pattern detected',
      evidenceHash: hashPiiValue(pan),
    });
  }

  // 3. Indian Phone number (+91 or 10 digits starting with 6-9)
  const phoneRegex = /(?:\+91[\s-]?)?([6-9]\d{9})\b/g;
  while ((match = phoneRegex.exec(text)) !== null) {
    const phone = match[1];
    const startNorm = match.index;
    const endNorm = match.index + match[0].length;
    findings.push({
      id: `fnd_phone_${Date.now()}_${findings.length}`,
      detector: 'PII Detector (Phone)',
      category: 'PII_PHONE',
      severity: 'MEDIUM',
      confidence: 0.9,
      segmentId: segment.id,
      start: mapOffsetToOriginal(norm.offsetMap, startNorm, segment.content.length),
      end: mapOffsetToOriginal(norm.offsetMap, endNorm, segment.content.length),
      reason: '10-digit mobile number detected',
      evidenceHash: hashPiiValue(phone),
    });
  }

  // 4. Email address
  const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
  while ((match = emailRegex.exec(text)) !== null) {
    const email = match[1];
    const startNorm = match.index;
    const endNorm = match.index + email.length;
    findings.push({
      id: `fnd_email_${Date.now()}_${findings.length}`,
      detector: 'PII Detector (Email)',
      category: 'PII_EMAIL',
      severity: 'LOW',
      confidence: 0.95,
      segmentId: segment.id,
      start: mapOffsetToOriginal(norm.offsetMap, startNorm, segment.content.length),
      end: mapOffsetToOriginal(norm.offsetMap, endNorm, segment.content.length),
      reason: 'Email address detected',
      evidenceHash: hashPiiValue(email.toLowerCase()),
    });
  }

  // 5. Card numbers with Luhn check
  const cardRegex = /\b(?:\d{4}[ -]?){3}\d{4}\b|\b\d{15,16}\b/g;
  while ((match = cardRegex.exec(text)) !== null) {
    const cardStr = match[0].replace(/[\s-]/g, '');
    if (validateLuhn(cardStr)) {
      const startNorm = match.index;
      const endNorm = match.index + match[0].length;
      findings.push({
        id: `fnd_card_${Date.now()}_${findings.length}`,
        detector: 'PII Detector (Credit Card / Luhn)',
        category: 'PII_CARD',
        severity: 'CRITICAL',
        confidence: 0.98,
        segmentId: segment.id,
        start: mapOffsetToOriginal(norm.offsetMap, startNorm, segment.content.length),
        end: mapOffsetToOriginal(norm.offsetMap, endNorm, segment.content.length),
        reason: 'Payment card number detected (Luhn checksum verified)',
        evidenceHash: hashPiiValue(cardStr),
      });
    }
  }

  // 6. Common API key formats
  const apiKeyRegexes = [
    { pattern: /\b(sk-[a-zA-Z0-9_-]{20,})\b/g, name: 'OpenAI-style API Key' },
    { pattern: /\b(AKIA[0-9A-Z]{16})\b/g, name: 'AWS Access Key ID' },
    { pattern: /\b(ghp_[a-zA-Z0-9]{36})\b/g, name: 'GitHub Personal Access Token' },
    { pattern: /\bBearer\s+([a-zA-Z0-9_.-]{24,})\b/g, name: 'Bearer Token' },
  ];

  for (const { pattern, name } of apiKeyRegexes) {
    while ((match = pattern.exec(text)) !== null) {
      const keyVal = match[1] || match[0];
      const startNorm = match.index;
      const endNorm = match.index + match[0].length;
      findings.push({
        id: `fnd_apikey_${Date.now()}_${findings.length}`,
        detector: `Secret Detector (${name})`,
        category: 'SECRET_API_KEY',
        severity: 'CRITICAL',
        confidence: 0.99,
        segmentId: segment.id,
        start: mapOffsetToOriginal(norm.offsetMap, startNorm, segment.content.length),
        end: mapOffsetToOriginal(norm.offsetMap, endNorm, segment.content.length),
        reason: `Potential secret / API credential detected (${name})`,
        evidenceHash: hashPiiValue(keyVal),
      });
    }
  }

  return findings;
}

/**
 * Redacts detected PII in outbound strings, replacing them with safe tokens.
 */
export function redactPii(content: string): { redactedText: string; redactionCount: number } {
  let count = 0;
  let result = content;

  // Redact Aadhaar
  result = result.replace(/\b([2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4})\b/g, (m) => {
    const raw = m.replace(/[\s-]/g, '');
    if (validateVerhoeff(raw)) {
      count++;
      return '[REDACTED:AADHAAR]';
    }
    return m;
  });

  // Redact PAN
  result = result.replace(/\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/g, () => {
    count++;
    return '[REDACTED:PAN]';
  });

  // Redact Card
  result = result.replace(/\b(?:\d{4}[ -]?){3}\d{4}\b|\b\d{15,16}\b/g, (m) => {
    const raw = m.replace(/[\s-]/g, '');
    if (validateLuhn(raw)) {
      count++;
      return '[REDACTED:CARD]';
    }
    return m;
  });

  // Redact API keys
  result = result.replace(/\b(sk-[a-zA-Z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36})\b/g, () => {
    count++;
    return '[REDACTED:KEY]';
  });

  return {
    redactedText: result,
    redactionCount: count,
  };
}
