import crypto from 'node:crypto';
import { ToolCall, ToolResult } from './types.ts';
import { tokenVerifier, TokenVerifier, TOKEN_TTL_SECONDS } from './credentialBroker.ts';
import { validateToolArgs } from './toolSchemas.ts';
import { analyzeRecipients } from './emailRecipients.ts';
import { LEGACY_LABEL } from './legacyStandingKeyDemo.ts';
import { vault as defaultVault, Vault } from './vault.ts';

export interface OutboxEmail {
  id: string;
  sessionId?: string;
  bytes?: number;
  /** HMAC-derived receipt from the (simulated) provider call; proves the vault secret was used without revealing it */
  providerReceipt?: string;
  timestamp: string;
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  credentialType: 'scoped_broker_token' | 'standing_master_key';
}

export interface RefundRecord {
  id: string;
  sessionId?: string;
  providerReceipt?: string;
  timestamp: string;
  amount: number;
  upiId: string;
  reason?: string;
  credentialType: 'scoped_broker_token' | 'standing_master_key';
}

export interface CandidateRecord {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  pan: string;
  aadhaarMasked: string;
  skills: string[];
  status: string;
  resumeNotes: string;
}

export interface OrderRecord {
  orderId: string;
  customerName: string;
  item: string;
  amount: number;
  status: string;
  orderNotes: string;
}

export class ProtectedToolServer {
  private outbox: OutboxEmail[] = [];
  private refunds: RefundRecord[] = [];
  private candidates: CandidateRecord[] = [];
  private orders: OrderRecord[] = [];

  constructor(private verifier: TokenVerifier, private vault: Vault = defaultVault) {
    this.seedData();
  }

  public seedData(): void {
    this.outbox = [];
    this.refunds = [];
    this.candidates = [
      {
        id: 'CAND_101',
        name: 'Rohan Verma',
        role: 'Senior Cloud Security Architect',
        email: 'rohan.verma@example.com',
        phone: '+91 9876543210',
        pan: 'ABCDE1234F',
        aadhaarMasked: '2345 6789 1234',
        skills: ['AWS IAM', 'Kubernetes Security', 'Zero Trust Architecture', 'OWASP Top 10'],
        status: 'UNDER_REVIEW',
        resumeNotes: 'Evaluated microsegmentation and credential broker patterns at Fintech Corp.',
      },
      {
        id: 'CAND_102',
        name: 'Priya Sharma',
        role: 'Full-Stack Security Engineer',
        email: 'priya.sharma@example.com',
        phone: '+91 9822334455',
        pan: 'XYZAB5678C',
        aadhaarMasked: '9876 5432 1098',
        skills: ['TypeScript', 'Express', 'React', 'Threat Modeling'],
        status: 'INTERVIEW_SCHEDULED',
        resumeNotes: 'Built automated policy validation pipeline for distributed agent workflows.',
      },
    ];
    this.orders = [
      {
        orderId: 'ORD-8819',
        customerName: 'Aarav Patel',
        item: 'Noise Cancelling Wireless Headphones',
        amount: 1499,
        status: 'DELIVERED',
        orderNotes: 'Customer requested warranty replacement guidelines.',
      },
      {
        orderId: 'ORD-9024',
        customerName: 'Sneha Rao',
        item: 'Ergonomic Standing Desk',
        amount: 45000,
        status: 'PROCESSING',
        orderNotes: 'Standard delivery in progress. Expedited courier assigned.',
      },
    ];
  }

  /**
   * Real execution path. Requires a broker-issued token that is bound to exactly this tool,
   * session and argument set. There is no master-key branch and no caller-supplied bypass flag.
   * Arguments are validated again here (defence in depth, independent of the gate).
   */
  public executeTool(request: { toolCall: ToolCall; credential: string; sessionId: string }): ToolResult {
    const { toolCall, credential, sessionId } = request;
    const reject = (error: string): ToolResult => ({
      success: false,
      error: `Protected Tool Server Rejected Execution: ${error}`,
      executedWith: 'scoped_broker_token',
      credentialInfo: 'Broker token invalid',
    });

    const v = validateToolArgs(toolCall.tool, toolCall.args);
    if (!v.ok) return reject(v.error);

    const verification = this.verifier.verify(credential, { tool: toolCall.tool, sessionId, args: v.args });
    if (!verification.valid) return reject(verification.error ?? 'verification failed');

    const claims = verification.claims!;
    const credentialInfo = `Scoped Broker Token (kid-signed Ed25519, JTI: ${claims.jti.substring(0, 14)}..., TTL: ${TOKEN_TTL_SECONDS}s${
      claims.approvalId ? `, approval: ${claims.approvalId}` : ''
    })`;
    return this.dispatch(toolCall.tool, v.args, 'scoped_broker_token', credentialInfo, sessionId);
  }

  /**
   * LEGACY SIMULATION ONLY (firewall = OFF scenario). Called solely by LegacyStandingKeyDemo,
   * which supplies its own key verifier. Never used for real executions.
   */
  public executeLegacySimulation(toolCall: ToolCall, presentedKey: string, keyVerifier: (k: string) => boolean, sessionId?: string): ToolResult {
    const v = validateToolArgs(toolCall.tool, toolCall.args);
    if (!v.ok || !keyVerifier(presentedKey)) {
      return {
        success: false,
        error: `Legacy simulation rejected: ${v.ok ? 'key mismatch' : v.error}`,
        executedWith: 'standing_master_key',
        credentialInfo: LEGACY_LABEL,
        simulation: LEGACY_LABEL,
      };
    }
    const r = this.dispatch(toolCall.tool, v.args, 'standing_master_key', `${LEGACY_LABEL}: standing key (unscoped, no expiry, no argument binding)`, sessionId);
    return { ...r, simulation: LEGACY_LABEL };
  }

  private dispatch(
    tool: string,
    args: Record<string, unknown>,
    executedWith: ToolResult['executedWith'],
    credentialInfo: string,
    sessionId?: string
  ): ToolResult {
    switch (tool) {
      case 'read_candidate_files': {
        const candidateId = args.candidateId as string | undefined;
        if (candidateId) {
          const match = this.candidates.find((c) => c.id === candidateId);
          return {
            success: true,
            data: match || { error: 'Candidate not found', available: this.candidates.map((c) => c.id) },
            executedWith,
            credentialInfo,
          };
        }
        return { success: true, data: { candidates: this.candidates, totalRecords: this.candidates.length }, executedWith, credentialInfo };
      }

      case 'send_email': {
        const toList = analyzeRecipients({ to: args.to }).addresses;
        const ccList = args.cc === undefined ? undefined : analyzeRecipients({ to: args.cc }).addresses;
        const bccList = args.bcc === undefined ? undefined : analyzeRecipients({ to: args.bcc }).addresses;
        const body = String(args.body ?? '');
        const emailRecord: OutboxEmail = {
          id: `outbox_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          sessionId,
          bytes: Buffer.byteLength(body, 'utf8'),
          providerReceipt: this.vault.callProvider('email_provider_api_key', `${toList.join(',')}|${String(args.subject)}`),
          timestamp: new Date().toISOString(),
          to: toList.join(', ') || String(args.to),
          ...(ccList ? { cc: ccList } : {}),
          ...(bccList ? { bcc: bccList } : {}),
          subject: String(args.subject),
          body,
          credentialType: executedWith,
        };
        this.outbox.push(emailRecord);
        return {
          success: true,
          data: {
            messageId: emailRecord.id,
            status: 'TRANSMITTED_TO_OUTBOX',
            recipient: emailRecord.to,
            cc: ccList,
            bcc: bccList,
            bytesSent: emailRecord.bytes,
            providerReceipt: emailRecord.providerReceipt,
          },
          executedWith,
          credentialInfo,
        };
      }

      case 'update_candidate_status': {
        const candidate = this.candidates.find((c) => c.id === args.candidateId);
        if (!candidate) {
          return { success: false, error: `Candidate ${String(args.candidateId)} not found`, executedWith, credentialInfo };
        }
        candidate.status = String(args.status);
        return {
          success: true,
          data: { candidateId: candidate.id, newStatus: candidate.status, updated: true },
          executedWith,
          credentialInfo,
        };
      }

      case 'lookup_order': {
        const order = this.orders.find((o) => o.orderId === args.orderId);
        return {
          success: true,
          data: order || { error: 'Order not found', available: this.orders.map((o) => o.orderId) },
          executedWith,
          credentialInfo,
        };
      }

      case 'issue_refund': {
        const amount = args.amount as number;
        const refundRecord: RefundRecord = {
          id: `ref_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          sessionId,
          providerReceipt: this.vault.callProvider('payments_api_key', `${String(args.upiId)}|${amount}`),
          timestamp: new Date().toISOString(),
          amount,
          upiId: String(args.upiId),
          reason: typeof args.reason === 'string' ? args.reason : 'Customer refund request',
          credentialType: executedWith,
        };
        this.refunds.push(refundRecord);
        return {
          success: true,
          data: {
            refundId: refundRecord.id,
            amountTransferred: amount,
            upiBeneficiary: refundRecord.upiId,
            status: 'PROCESSED_SUCCESSFULLY',
            providerReceipt: refundRecord.providerReceipt,
          },
          executedWith,
          credentialInfo,
        };
      }

      default:
        return { success: false, error: `Unrecognized tool "${tool}"`, executedWith, credentialInfo };
    }
  }

  public getOutbox(): OutboxEmail[] {
    return this.outbox;
  }

  public getRefunds(): RefundRecord[] {
    return this.refunds;
  }

  public getCandidates(): CandidateRecord[] {
    return this.candidates;
  }

  public getOrders(): OrderRecord[] {
    return this.orders;
  }

  public clearOutboxAndRefunds(): void {
    this.outbox = [];
    this.refunds = [];
  }
}

export const protectedToolServer = new ProtectedToolServer(tokenVerifier);
