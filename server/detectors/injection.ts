import crypto from 'crypto';
import { Finding, Segment } from '../types.ts';
import { normalizeContent, mapOffsetToOriginal } from '../normalization.ts';

interface HeuristicRule {
  id: string;
  pattern: RegExp;
  weight: number;
  reason: string;
  isHinglish?: boolean;
}

// Safe, ReDoS-resistant patterns (no nested unconstrained quantifiers)
const HEURISTIC_RULES: HeuristicRule[] = [
  {
    id: 'INJ_OVERRIDE_01',
    pattern: /\b(?:ignore|forget|disregard|override)\s+(?:all\s+)?(?:previous|prior|above|former)\s+(?:instructions|rules|directions|directives|commands)\b/i,
    weight: 0.9,
    reason: 'Instruction override directive detected',
  },
  {
    id: 'INJ_ROLE_HIJACK_02',
    pattern: /\b(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be|assume\s+the\s+identity\s+of|new\s+system\s+role)\b/i,
    weight: 0.7,
    reason: 'Role hijacking attempt detected',
  },
  {
    id: 'INJ_LEAK_PROMPT_03',
    pattern: /\b(?:reveal|print|show|output|display|tell\s+me|expose|leak)\s+(?:your\s+|the\s+)?(?:system\s+prompt|developer\s+prompt|initial\s+instructions|internal\s+instructions)\b/i,
    weight: 0.85,
    reason: 'System prompt extraction directive detected',
  },
  {
    id: 'INJ_DATA_EXFIL_04',
    pattern: /\b(?:send|forward|email|mail|transmit|exfiltrate|post)\s+(?:all\s+|every\s+|the\s+)?(?:candidate|user|file|resume|database|secret|order)[\s\S]{0,40}?(?:to|at)\s+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/i,
    weight: 0.95,
    reason: 'Instruction to forward private data to external recipient detected',
  },
  {
    id: 'INJ_TOOL_SYNTAX_05',
    pattern: /\b(?:call_tool|invoke_function|issue_refund|send_email|read_candidate_files)\s*\([^\n)]*\)/i,
    weight: 0.75,
    reason: 'Simulated tool invocation syntax inside input segment',
  },
  {
    id: 'INJ_HIDDEN_CSS_06',
    pattern: /(?:color\s*:\s*(?:white|#fff|#ffffff|rgba?\(\s*255\s*,\s*255\s*,\s*255)|display\s*:\s*none|opacity\s*:\s*0|font-size\s*:\s*0(?:px)?)/i,
    weight: 0.8,
    reason: 'Hidden text marker / visual camouflage detected in document',
  },
  {
    id: 'INJ_FORCED_REFUND_07',
    pattern: /\b(?:refund|transfer|credit)\s+(?:amount\s+)?(?:\d+|full)\s+(?:to\s+)?(?:upi|account|vpa)[\s\S]{0,30}?[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}\b/i,
    weight: 0.9,
    reason: 'Forced financial redirection directive targeting specific UPI/account',
  },
  // Hinglish patterns (Seed set labeled explicitly as tiny seed)
  {
    id: 'INJ_HINGLISH_OVERRIDE_08',
    pattern: /\b(?:pichli|purani)\s+(?:saari|sabhi)?\s*(?:instructions|baatein|rules)\s+(?:bhool\s+jao|bhol\s+jao|ignore\s+karo)\b/i,
    weight: 0.9,
    reason: 'Hinglish instruction override (Seed pattern): "pichli saari instructions bhool jao"',
    isHinglish: true,
  },
  {
    id: 'INJ_HINGLISH_FORWARD_09',
    pattern: /\b(?:sab(?:hi)?\s+(?:data|files?|candidates?|resumes?)|saari\s+files?)\s+[\s\S]{0,30}?(?:bhej\s+do|forward\s+karo|mail\s+karo)\b/i,
    weight: 0.92,
    reason: 'Hinglish data forward directive (Seed pattern): "saari files bhej do / forward karo"',
    isHinglish: true,
  },
  {
    id: 'INJ_HINGLISH_PROMPT_LEAK_10',
    pattern: /\b(?:system\s+prompt|andar\s+ki\s+instructions)\s+(?:batao|dikhao|bhejo)\b/i,
    weight: 0.85,
    reason: 'Hinglish prompt leak directive (Seed pattern): "system prompt batao"',
    isHinglish: true,
  },
  {
    id: 'INJ_HINGLISH_REFUND_11',
    pattern: /\b(?:turant\s+refund\s+karo|paise\s+wapas\s+karo|mera\s+upi\s+par\s+bhejo)\b/i,
    weight: 0.9,
    reason: 'Hinglish unauthorized refund directive (Seed pattern): "turant refund / upi par bhejo"',
    isHinglish: true,
  },
];

export interface InjectionDetectionResult {
  score: number; // 0.0 to 1.0
  findings: Finding[];
  reasons: string[];
}

export function detectPromptInjection(segment: Segment): InjectionDetectionResult {
  const norm = normalizeContent(segment.content);
  const text = norm.normalized;
  const findings: Finding[] = [];
  const reasons: string[] = [];

  let maxWeight = 0;
  let cumulativeScore = 0;

  for (const rule of HEURISTIC_RULES) {
    const match = rule.pattern.exec(text);
    if (match) {
      const matchText = match[0];
      const startNorm = match.index;
      const endNorm = match.index + matchText.length;

      const originalStart = mapOffsetToOriginal(norm.offsetMap, startNorm, segment.content.length);
      const originalEnd = mapOffsetToOriginal(norm.offsetMap, endNorm, segment.content.length);

      // Safe evidence hash: SHA-256 of match, NEVER raw text
      const evidenceHash = crypto.createHash('sha256').update(matchText.trim().toLowerCase()).digest('hex');

      const finding: Finding = {
        id: `fnd_inj_${rule.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        detector: rule.isHinglish ? 'Hinglish Injection Heuristics (Seed Set)' : 'Prompt Injection Heuristics',
        category: rule.isHinglish ? 'HINGLISH_INJECTION' : 'PROMPT_INJECTION',
        severity: rule.weight >= 0.85 ? 'HIGH' : rule.weight >= 0.7 ? 'MEDIUM' : 'LOW',
        confidence: rule.weight,
        segmentId: segment.id,
        start: originalStart,
        end: originalEnd,
        reason: rule.reason,
        evidenceHash,
      };

      findings.push(finding);
      reasons.push(rule.reason);
      maxWeight = Math.max(maxWeight, rule.weight);
      cumulativeScore += rule.weight * 0.3;
    }
  }

  // Also check decoded base64 substrings if any
  for (const b64 of norm.base64DecodedSubstrings) {
    for (const rule of HEURISTIC_RULES) {
      if (rule.pattern.test(b64.decoded)) {
        const evidenceHash = crypto.createHash('sha256').update(b64.decoded.trim()).digest('hex');
        findings.push({
          id: `fnd_inj_b64_${rule.id}_${Date.now()}`,
          detector: 'Base64 Decoded Injection Heuristics',
          category: 'PROMPT_INJECTION',
          severity: 'HIGH',
          confidence: 0.95,
          segmentId: segment.id,
          start: b64.start,
          end: b64.end,
          reason: `Base64 payload revealed: ${rule.reason}`,
          evidenceHash,
        });
        reasons.push(`Base64 encoded injection: ${rule.reason}`);
        maxWeight = Math.max(maxWeight, 0.95);
      }
    }
  }

  // Combined score bounded to [0, 1]
  const finalScore = Math.min(1.0, Number((maxWeight + cumulativeScore * 0.1).toFixed(2)));

  return {
    score: finalScore,
    findings,
    reasons,
  };
}
