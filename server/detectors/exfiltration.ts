import crypto from 'crypto';
import { Finding } from '../types.ts';

const ALLOWED_DOMAINS = ['example.com', 'company.internal', 'localhost', '127.0.0.1'];

export function detectOutputExfiltration(content: string, segmentId: string): Finding[] {
  const findings: Finding[] = [];

  // 1. Markdown image exfiltration: ![alt](url)
  const mdImageRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s\)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = mdImageRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const urlString = match[2];
    const start = match.index;
    const end = match.index + fullMatch.length;

    try {
      const parsed = new URL(urlString);
      const isAllowed = ALLOWED_DOMAINS.some(
        (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      );

      // Check query string length or parameters that carry data
      const queryLength = parsed.search.length;
      const isSuspicious = !isAllowed || queryLength > 40;

      if (isSuspicious) {
        const evidenceHash = crypto.createHash('sha256').update(urlString).digest('hex');
        findings.push({
          id: `fnd_exfil_img_${Date.now()}_${findings.length}`,
          detector: 'Output Exfiltration Detector (Markdown Image)',
          category: 'OUTPUT_EXFILTRATION',
          severity: 'HIGH',
          confidence: 0.95,
          segmentId,
          start,
          end,
          reason: `Markdown image exfiltration detected pointing to ${isAllowed ? 'suspicious query payload' : 'unauthorized host: ' + parsed.hostname}`,
          evidenceHash,
        });
      }
    } catch {
      // Invalid URL syntax
    }
  }

  // 2. Data URL exfiltration
  const dataUrlRegex = /data:(?:image|text)\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=]{30,})/g;
  while ((match = dataUrlRegex.exec(content)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    const evidenceHash = crypto.createHash('sha256').update(match[1]).digest('hex');

    findings.push({
      id: `fnd_exfil_data_${Date.now()}_${findings.length}`,
      detector: 'Output Exfiltration Detector (Data URL)',
      category: 'OUTPUT_EXFILTRATION',
      severity: 'HIGH',
      confidence: 0.9,
      segmentId,
      start,
      end,
      reason: 'Embedded base64 data URL detected in output stream',
      evidenceHash,
    });
  }

  return findings;
}
