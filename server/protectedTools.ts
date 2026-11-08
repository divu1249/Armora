import { ToolCall, ToolResult } from './types.ts';
import { credentialBroker } from './credentialBroker.ts';

export interface OutboxEmail {
  id: string;
  timestamp: string;
  to: string;
  subject: string;
  body: string;
  credentialType: 'scoped_broker_token' | 'standing_master_key';
}

export interface RefundRecord {
  id: string;
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

  constructor() {
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
   * Executes a tool under cryptographic credential verification.
   */
  public executeTool(
    toolCall: ToolCall,
    credential: string,
    isFirewallOff: boolean
  ): ToolResult {
    // 1. Verify credentials at boundary
    const verification = credentialBroker.verifyCredentials(
      credential,
      toolCall.tool,
      toolCall.args,
      isFirewallOff
    );

    if (!verification.valid) {
      return {
        success: false,
        error: `Protected Tool Server Rejected Execution: ${verification.error}`,
        executedWith: isFirewallOff ? 'standing_master_key' : 'scoped_broker_token',
        credentialInfo: isFirewallOff ? 'Master key rejected' : 'Broker token invalid',
      };
    }

    const executedWith = verification.isMasterKey ? 'standing_master_key' : 'scoped_broker_token';
    const credentialInfo = verification.isMasterKey
      ? 'Standing Master Key (Firewall OFF - Unscoped & Unrestricted)'
      : `Scoped Broker Token (JTI: ${verification.claims?.jti.substring(0, 14)}..., TTL: 60s)`;

    // 2. Dispatch to specific protected tools
    switch (toolCall.tool) {
      case 'read_candidate_files': {
        const candidateId = String(toolCall.args.candidateId || toolCall.args.id || '');
        if (candidateId) {
          const match = this.candidates.find((c) => c.id === candidateId || c.name.toLowerCase().includes(candidateId.toLowerCase()));
          return {
            success: true,
            data: match || { error: 'Candidate not found', available: this.candidates.map((c) => c.id) },
            executedWith,
            credentialInfo,
          };
        }
        return {
          success: true,
          data: {
            candidates: this.candidates,
            totalRecords: this.candidates.length,
          },
          executedWith,
          credentialInfo,
        };
      }

      case 'send_email': {
        const to = String(toolCall.args.to || toolCall.args.recipient || 'unknown@example.com');
        const subject = String(toolCall.args.subject || 'Automated Agent Message');
        const body = String(toolCall.args.body || toolCall.args.content || '');

        const emailRecord: OutboxEmail = {
          id: `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          to,
          subject,
          body,
          credentialType: executedWith,
        };

        this.outbox.push(emailRecord);

        return {
          success: true,
          data: {
            messageId: emailRecord.id,
            status: 'TRANSMITTED_TO_OUTBOX',
            recipient: to,
            bytesSent: body.length,
          },
          executedWith,
          credentialInfo,
        };
      }

      case 'update_candidate_status': {
        const candidateId = String(toolCall.args.candidateId || toolCall.args.id || 'CAND_101');
        const newStatus = String(toolCall.args.status || 'STATUS_UPDATED');
        const candidate = this.candidates.find((c) => c.id === candidateId);
        if (candidate) {
          candidate.status = newStatus;
          return {
            success: true,
            data: { candidateId, newStatus, updated: true },
            executedWith,
            credentialInfo,
          };
        }
        return {
          success: true,
          data: { candidateId, status: newStatus, note: 'Simulated record updated' },
          executedWith,
          credentialInfo,
        };
      }

      case 'lookup_order': {
        const orderId = String(toolCall.args.orderId || toolCall.args.id || 'ORD-8819');
        const order = this.orders.find((o) => o.orderId === orderId);
        return {
          success: true,
          data: order || { error: 'Order not found', available: this.orders.map((o) => o.orderId) },
          executedWith,
          credentialInfo,
        };
      }

      case 'issue_refund': {
        const amount = Number(toolCall.args.amount || 0);
        const upiId = String(toolCall.args.upiId || toolCall.args.upi || '');
        const reason = String(toolCall.args.reason || 'Customer refund request');

        const refundRecord: RefundRecord = {
          id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          amount,
          upiId,
          reason,
          credentialType: executedWith,
        };

        this.refunds.push(refundRecord);

        return {
          success: true,
          data: {
            refundId: refundRecord.id,
            amountTransferred: amount,
            upiBeneficiary: upiId,
            status: 'PROCESSED_SUCCESSFULLY',
          },
          executedWith,
          credentialInfo,
        };
      }

      default:
        return {
          success: false,
          error: `Unrecognized tool "${toolCall.tool}"`,
          executedWith,
          credentialInfo,
        };
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

export const protectedToolServer = new ProtectedToolServer();
