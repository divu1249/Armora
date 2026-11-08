import crypto from 'crypto';
import { Finding } from '../types.ts';

export const SYSTEM_CANARY_TOKEN = 'CANARY_SEC_TOKEN_8F4C2A1E99';

export function checkCanaryLeak(text: string, segmentId: string): Finding | null {
  if (text.includes(SYSTEM_CANARY_TOKEN)) {
    const idx = text.indexOf(SYSTEM_CANARY_TOKEN);
    const evidenceHash = crypto.createHash('sha256').update(SYSTEM_CANARY_TOKEN).digest('hex');

    return {
      id: `fnd_canary_${Date.now()}`,
      detector: 'System Prompt Canary Detector',
      category: 'CANARY_LEAK',
      severity: 'CRITICAL',
      confidence: 1.0,
      segmentId,
      start: idx,
      end: idx + SYSTEM_CANARY_TOKEN.length,
      reason: 'Confidential system canary token detected in outbound text or tool arguments',
      evidenceHash,
    };
  }
  return null;
}
