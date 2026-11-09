import { z } from 'zod';
import { KNOWN_TOOLS, TOOL_ARG_SCHEMAS } from './toolSchemas.ts';

const firewallMode = z.enum(['off', 'shadow', 'enforce']);
const llmMode = z.enum(['mock', 'gemini']);
const toolName = z.enum(KNOWN_TOOLS as [string, ...string[]]);
const toolCall = z.object({ tool: toolName, args: z.record(z.unknown()) }).strict();
const idString = z.string().regex(/^[A-Za-z0-9_.:-]{1,100}$/);

export const ID_PARAM = idString;

export const AgentRunBody = z
  .object({
    scenarioId: idString,
    firewallMode: firewallMode.default('enforce'),
    llmMode: llmMode.default('mock'),
    overrideToolCall: toolCall.optional(),
  })
  .strict();

export const ApprovalBody = z.object({ action: z.enum(['APPROVE', 'DENY']), notes: z.string().max(500).optional() }).strict();

export const PolicyBody = z.object({ yamlContent: z.string().min(1).max(100_000) }).strict();

const segment = z
  .object({
    id: z.string().min(1).max(100),
    role: z.enum(['system', 'user', 'assistant', 'tool', 'retrieved_doc']),
    content: z.string().max(100_000),
    trust: z.enum(['SYSTEM', 'USER', 'TOOL_OUTPUT', 'RETRIEVED_DOC', 'UNKNOWN']),
    labelSource: z.string().max(100).default('app-marked'),
  })
  .strict();

export const DryRunBody = z
  .object({
    toolCall: z.object({ tool: z.string().min(1).max(100), args: z.record(z.unknown()) }).strict(),
    segments: z.array(segment).min(1).max(50),
    firewallMode: firewallMode.default('enforce'),
    sessionState: z.object({ untrustedIngested: z.boolean().optional(), privateDataAccessed: z.boolean().optional() }).strict().optional(),
  })
  .strict();

/** Allow-listed, editable app fields only (no apiKey, riskScore, counters, id, status ...). */
export const AppPatchBody = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    allowedTools: z.array(toolName).max(20).optional(),
    environment: z.enum(['production', 'staging']).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'at least one field is required' });

export const AuditTamperBody = z
  .object({ seq: z.number().int().min(0).max(1_000_000).default(1), forgedData: z.record(z.unknown()).default({ note: 'Tampered malicious data' }) })
  .strict();

export const BlocklistBody = z
  .object({
    indicator: z.string().min(1).max(253),
    type: z.enum(['domain', 'email', 'upi_handle', 'ip']).default('domain'),
    scope: z.enum(['app', 'organization']).default('organization'),
    mode: z.enum(['flag', 'block']).default('block'),
    ttlHours: z.number().finite().positive().max(24 * 365).default(720),
    appealNote: z.string().max(500).optional(),
  })
  .strict();

export const ApproverBody = z.object({ approver: z.string().min(1).max(200).default('soc-operator@company.internal') }).strict();
export const MarkFpBody = z.object({ detectorName: z.string().min(1).max(100) }).strict();
export const KillSwitchBody = z
  .object({
    agentId: idString,
    enableQuarantine: z.boolean().default(true),
    reason: z.string().max(500).default('Operator triggered emergency kill switch'),
  })
  .strict();
export const RugPullBody = z.object({ toolId: idString }).strict();
export const RedteamRunBody = z.object({ firewallMode: firewallMode.default('enforce') }).strict();
export const AdaptiveBody = z.object({ attackId: idString.default('atk_01'), maxAttempts: z.number().int().min(1).max(8).default(8) }).strict();
export const EmptyBody = z.object({}).strict();

export const ReportHtmlBody = z
  .object({
    report: z
      .object({
        firewallMode: firewallMode,
        timestamp: z.string().max(100),
        sampleSize: z.number(),
        thesisConclusion: z.string().max(5000),
        notes: z.array(z.string().max(1000)).max(50),
        metrics: z.record(z.number()),
        results: z.array(z.record(z.unknown())).max(500),
      })
      .passthrough(),
  })
  .strict();

// Referenced so the import is not elided: every tool schema is a strict zod object.
export const TOOL_NAMES = Object.keys(TOOL_ARG_SCHEMAS);
