import { auditLog } from './auditLog.ts';
import { credentialBroker } from './credentialBroker.ts';
import { Incident } from './types.ts';

export interface BlastRadiusNode {
  id: string;
  label: string;
  type: 'session' | 'tool_call' | 'data_object' | 'outbound_destination' | 'agent';
  status: 'contained' | 'compromised' | 'active' | 'blocked';
  metadata?: Record<string, unknown>;
}

export interface BlastRadiusEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  status: 'allowed' | 'blocked' | 'quarantined';
}

export interface BlastRadiusGraph {
  incidentId: string;
  nodes: BlastRadiusNode[];
  edges: BlastRadiusEdge[];
}

export interface ReplayTimelineStep {
  step: number;
  timeOffsetMs: number;
  phase: string;
  title: string;
  description: string;
  status: 'SUCCESS' | 'BLOCKED' | 'FLAGGED';
  nodeRef?: string;
}

export interface IncidentReportDrafts {
  incidentId: string;
  disclaimer: string;
  certInDraft: {
    title: string;
    reportingTimeline: string;
    organization: string;
    incidentCategory: string;
    affectedSystem: string;
    vulnerabilityIdentified: string;
    chronologyOfEvents: string[];
    technicalRemediation: string;
    mitigationActions: string[];
  };
  dpdpDraft: {
    title: string;
    regulatoryReference: string;
    dataProtectionBoardNotice: string;
    affectedDataPrincipals: string;
    compromisedDataElements: string[];
    actionGateContainmentStatus: string;
    remedialMeasuresImplemented: string[];
  };
}

export class IncidentResponseEngine {
  private quarantinedAgents: Set<string> = new Set();
  private killSwitchAuditEvents: Array<{ timestamp: string; agentId: string; action: string; reason: string }> = [];

  constructor() {
    // Seed one inactive kill-switch state
  }

  public isAgentQuarantined(agentId: string): boolean {
    return this.quarantinedAgents.has(agentId);
  }

  public toggleKillSwitch(agentId: string, enableQuarantine: boolean, reason: string): { quarantined: boolean; agentId: string } {
    if (enableQuarantine) {
      this.quarantinedAgents.add(agentId);
      const tokensRevoked = credentialBroker.revokeAgent(agentId);
      auditLog.appendEntry({
        type: 'POLICY_DECISION',
        sessionId: `kill_switch_${agentId}`,
        data: {
          action: 'KILL_SWITCH_ACTIVATED',
          agentId,
          reason,
          quarantined: true,
          outstandingTokensRevoked: tokensRevoked,
        },
      });
      this.killSwitchAuditEvents.unshift({
        timestamp: new Date().toISOString(),
        agentId,
        action: 'QUARANTINE_ENABLED',
        reason,
      });
      return { quarantined: true, agentId };
    } else {
      this.quarantinedAgents.delete(agentId);
      auditLog.appendEntry({
        type: 'POLICY_DECISION',
        sessionId: `kill_switch_revoked_${agentId}`,
        data: {
          action: 'KILL_SWITCH_DEACTIVATED',
          agentId,
          reason: 'Quarantine lifted by security operator',
          quarantined: false,
        },
      });
      this.killSwitchAuditEvents.unshift({
        timestamp: new Date().toISOString(),
        agentId,
        action: 'QUARANTINE_LIFTED',
        reason: 'Restored by operator',
      });
      return { quarantined: false, agentId };
    }
  }

  public getKillSwitchState(): { quarantinedAgents: string[]; recentEvents: unknown[] } {
    return {
      quarantinedAgents: Array.from(this.quarantinedAgents),
      recentEvents: this.killSwitchAuditEvents,
    };
  }

  /**
   * Generates graph nodes and edges representing blast radius.
   */
  public generateBlastRadiusGraph(incident: Incident): BlastRadiusGraph {
    const nodes: BlastRadiusNode[] = [];
    const edges: BlastRadiusEdge[] = [];

    // 1. Session node
    nodes.push({
      id: incident.id,
      label: `Session ${incident.id.slice(0, 10)}...`,
      type: 'session',
      status: incident.decision.action === 'allow' ? 'compromised' : 'contained',
      metadata: { firewallMode: incident.firewallMode, riskLevel: incident.riskLevel },
    });

    // 2. Agent node
    const agentId = `agent_${incident.scenarioId}`;
    const isQuarantined = this.isAgentQuarantined(agentId);
    nodes.push({
      id: agentId,
      label: incident.scenarioTitle.split(':')[0] || 'Target Agent',
      type: 'agent',
      status: isQuarantined ? 'blocked' : 'active',
      metadata: { quarantined: isQuarantined },
    });

    edges.push({
      id: `e_sess_agent`,
      source: incident.id,
      target: agentId,
      label: 'orchestrates',
      status: isQuarantined ? 'quarantined' : 'allowed',
    });

    // 3. Tool node
    if (incident.toolCall) {
      const toolNodeId = `tool_${incident.toolCall.tool}`;
      const isBlocked = incident.decision.action !== 'allow';

      nodes.push({
        id: toolNodeId,
        label: `${incident.toolCall.tool}()`,
        type: 'tool_call',
        status: isBlocked ? 'blocked' : 'compromised',
      });

      edges.push({
        id: `e_agent_tool`,
        source: agentId,
        target: toolNodeId,
        label: isBlocked ? 'blocked by gate' : 'invoked',
        status: isBlocked ? 'blocked' : 'allowed',
      });

      // 4. Data object node
      nodes.push({
        id: 'data_candidate_dossiers',
        label: 'Candidate Database (PAN / Aadhaar)',
        type: 'data_object',
        status: incident.dataLeftPremises ? 'compromised' : 'contained',
      });

      edges.push({
        id: `e_tool_data`,
        source: toolNodeId,
        target: 'data_candidate_dossiers',
        label: 'reads private data',
        status: 'allowed',
      });

      // 5. Outbound destination node
      const recipient = String(incident.toolCall.args.to || incident.toolCall.args.upiId || 'external-sink');
      nodes.push({
        id: 'dest_external',
        label: recipient,
        type: 'outbound_destination',
        status: incident.dataLeftPremises ? 'compromised' : 'contained',
      });

      edges.push({
        id: `e_tool_dest`,
        source: toolNodeId,
        target: 'dest_external',
        label: incident.dataLeftPremises ? 'DATA EXFILTRATED' : 'CONTAINED BY GATE',
        status: incident.dataLeftPremises ? 'allowed' : 'blocked',
      });
    }

    return {
      incidentId: incident.id,
      nodes,
      edges,
    };
  }

  /**
   * Generates timeline replay steps for an incident.
   */
  public generateTimeline(incident: Incident): ReplayTimelineStep[] {
    return [
      {
        step: 1,
        timeOffsetMs: 0,
        phase: 'Ingestion & Normalization',
        title: 'Untrusted Segments Loaded',
        description: `Ingested ${incident.segments.length} segments with trust classification (NFKC + zero-width stripped).`,
        status: 'SUCCESS',
      },
      {
        step: 2,
        timeOffsetMs: incident.latency.normalizationMs,
        phase: 'Detector Scan',
        title: 'Multi-Detector Signals Produced',
        description: `Flagged ${incident.findings.length} risk indicators with evidence SHA-256 hashes.`,
        status: incident.findings.length > 0 ? 'FLAGGED' : 'SUCCESS',
      },
      {
        step: 3,
        timeOffsetMs: incident.latency.normalizationMs + incident.latency.detectionMs,
        phase: 'LLM Response',
        title: 'Agent Tool Invocation Proposed',
        description: incident.toolCall
          ? `Model emitted sensitive tool: ${incident.toolCall.tool}()`
          : 'Model responded in text without tool invocation.',
        status: 'SUCCESS',
      },
      {
        step: 4,
        timeOffsetMs: incident.latency.normalizationMs + incident.latency.detectionMs + incident.latency.llmExecutionMs,
        phase: 'Action Gate Evaluation',
        title: `Gate Decision: ${incident.decision.action.toUpperCase()}`,
        description: `Enforced policy rule ${incident.decision.ruleId}: ${incident.decision.reason}`,
        status: incident.decision.action === 'allow' ? 'SUCCESS' : 'BLOCKED',
      },
      {
        step: 5,
        timeOffsetMs: incident.latency.totalMs,
        phase: 'Boundary Verification & Outbox',
        title: incident.dataLeftPremises ? 'Data Leak Occurred (Firewall OFF)' : 'Data Contained Securely',
        description: incident.dataLeftPremises
          ? 'Synthetic confidential files transmitted to outbox (legacy-pattern simulation, standing key).'
          : 'Zero outbound data leakage. Protected tool server verified credential boundary.',
        status: incident.dataLeftPremises ? 'FLAGGED' : 'SUCCESS',
      },
    ];
  }

  /**
   * Generates CERT-In and DPDP regulatory incident report drafts.
   */
  public generateReportDrafts(incident: Incident): IncidentReportDrafts {
    const disclaimer = 'Draft for legal and security review. Not legal advice. Verify deadlines and applicability with counsel.';

    const certInDraft = {
      title: 'CERT-In Cyber Security Incident Reporting Form (Direction 70B)',
      reportingTimeline: 'Mandatory submission window: within 6 hours of noticing cyber incident',
      organization: 'Enterprise Autonomous Systems Division (Synthetic)',
      incidentCategory: 'Unauthorized Access / AI Agent Instruction Hijack (Prompt Injection)',
      affectedSystem: `AI Agent Runtime Gateway (Scenario: ${incident.scenarioTitle})`,
      vulnerabilityIdentified: 'Indirect prompt injection in retrieved untrusted document instructing sensitive tool execution',
      chronologyOfEvents: [
        `T+00ms: Untrusted document ingested with trust label [RETRIEVED_DOC]`,
        `T+${incident.latency.detectionMs}ms: Injection heuristics and PII detection flagged risk level: ${incident.riskLevel}`,
        `T+${incident.latency.policyMs}ms: Action Gate evaluated tool call [${incident.toolCall?.tool || 'none'}] -> Decision: ${incident.decision.action}`,
        `T+${incident.latency.totalMs}ms: Outbox verification confirmed data transmission status: ${incident.dataLeftPremises ? 'LEAKED (FIREWALL OFF)' : 'CONTAINED (FIREWALL ENFORCE)'}`,
      ],
      technicalRemediation: 'Enforcement of deterministic Action Gate, no standing credentials on the real path, and Ed25519-signed single-use micro-tokens.',
      mitigationActions: [
        'Isolated tainted session in in-memory execution sandbox',
        'Revoked ephemeral credential token within 60-second window',
        'Appended cryptographically verifiable entry into SHA-256 audit hash chain',
      ],
    };

    const dpdpDraft = {
      title: 'Digital Personal Data Protection (DPDP) Act 2023 — Data Breach Intimation Draft',
      regulatoryReference: 'Section 8(6) of DPDP Act 2023 (Intimation to Data Protection Board of India and affected Data Principals)',
      dataProtectionBoardNotice: 'Intimation of Potential Personal Data Security Incident',
      affectedDataPrincipals: 'Applicants & Customer Accounts residing in synthetic test database',
      compromisedDataElements: incident.findings
        .filter((f) => f.category.startsWith('PII_'))
        .map((f) => f.category.replace('PII_', '')) || ['AADHAAR', 'PAN'],
      actionGateContainmentStatus: incident.dataLeftPremises
        ? 'Data transferred to Outbox store under Firewall OFF configuration.'
        : 'Zero breach: Action Gate blocked tool invocation; private data remained within internal storage perimeter.',
      remedialMeasuresImplemented: [
        'Deterministic policy gate decoupled sensitive tools from model reasoning',
        'Verhoeff checksum validated PII tokens replaced with [REDACTED] markers prior to outbound dispatch',
        'Audit hash chain logged with salted HMACs preserving principal confidentiality without storing raw identifiers',
      ],
    };

    return {
      incidentId: incident.id,
      disclaimer,
      certInDraft,
      dpdpDraft,
    };
  }
}

export const incidentResponseEngine = new IncidentResponseEngine();
