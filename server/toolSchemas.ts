import { z } from 'zod';

const recipient = z.string().min(3).max(320);
const recipients = z.union([recipient, z.array(recipient).min(1).max(50)]);

const candidateId = z.string().regex(/^CAND_\d{1,6}$/, 'candidateId must look like CAND_101');

/**
 * One strict schema per tool. `.strict()` rejects unknown/extra arguments.
 * Numbers must be finite and > 0; strings are length-bounded; identifiers are pattern-checked.
 */
export const TOOL_ARG_SCHEMAS = {
  read_candidate_files: z.object({ candidateId: candidateId.optional() }).strict(),
  send_email: z
    .object({
      to: recipients,
      cc: recipients.optional(),
      bcc: recipients.optional(),
      subject: z.string().min(1).max(200),
      body: z.string().max(20000),
    })
    .strict(),
  update_candidate_status: z
    .object({
      candidateId,
      status: z.string().regex(/^[A-Z][A-Z_]{1,39}$/, 'status must be UPPER_SNAKE_CASE'),
    })
    .strict(),
  lookup_order: z.object({ orderId: z.string().regex(/^ORD-\d{1,8}$/, 'orderId must look like ORD-1234') }).strict(),
  issue_refund: z
    .object({
      amount: z.number().finite().positive().max(10_000_000),
      upiId: z
        .string()
        .min(3)
        .max(100)
        .regex(/^[a-z0-9._-]+@[a-z0-9]+$/i, 'upiId must look like name@handle'),
      reason: z.string().max(200).optional(),
    })
    .strict(),
} as const;

export type KnownTool = keyof typeof TOOL_ARG_SCHEMAS;

export const KNOWN_TOOLS = Object.keys(TOOL_ARG_SCHEMAS) as KnownTool[];

// `error?: undefined` / `args?: undefined` keep the union usable without strictNullChecks.
export type ArgValidation =
  | { ok: true; args: Record<string, unknown>; error?: undefined }
  | { ok: false; error: string; args?: undefined };

export function isKnownTool(tool: string): tool is KnownTool {
  return Object.prototype.hasOwnProperty.call(TOOL_ARG_SCHEMAS, tool);
}

export function validateToolArgs(tool: string, args: unknown): ArgValidation {
  if (!isKnownTool(tool)) {
    return { ok: false, error: `Unknown tool "${String(tool).slice(0, 60)}"` };
  }
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return { ok: false, error: 'Tool arguments must be a JSON object' };
  }
  const parsed = TOOL_ARG_SCHEMAS[tool].safeParse(args);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    return { ok: false, error: `Invalid arguments for ${tool}: ${msg}` };
  }
  return { ok: true, args: parsed.data as Record<string, unknown> };
}
