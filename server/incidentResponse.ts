import { eventLedger } from './ledger.ts';
import { credentialBroker } from './credentialBroker.ts';
import { protectedToolServer } from './protectedTools.ts';
import { Incident } from './types.ts';
import {
  BlastRadiusEdge,
  BlastRadiusGraph,
  BlastRadiusNode,
  IncidentReportDrafts,
  ReplayTimelineStep,
  buildBlastRadius,
  buildReportDrafts,
  buildTimeline,
} from './blastRadius.ts';

export type { BlastRadiusEdge, BlastRadiusGraph, BlastRadiusNode, IncidentReportDrafts, ReplayTimelineStep };

export class IncidentResponseEngine {
  private quarantinedAgents: Set<string> = new Set();
  private killSwitchAuditEvents: Array<{ timestamp: string; agentId: string; action: string; reason: string }> = [];

  constructor() {
    // Seed one inactive kill-switch state
  }

  public isAgentQuarantined(agentId: string): boolean {
    return this.quarantinedAgents.has(agentId);
  }

  public toggleKillSwitch(agentId: string, enableQuarantine: boolean, reason: string): { quarantined: boolean; agentId: string; tokensRevoked: number } {
    if (enableQuarantine) {
      this.quarantinedAgents.add(agentId);
      const tokensRevoked = credentialBroker.revokeAgent(agentId, `kill switch: ${reason}`);
      eventLedger.record({
        sessionId: `kill_switch_${agentId}`,
        type: 'KILL_SWITCH',
        agentId,
        action: 'quarantined',
        data: { state: 'ACTIVATED', reason, quarantined: true, outstandingTokensRevoked: tokensRevoked },
      });
      this.killSwitchAuditEvents.unshift({ timestamp: new Date().toISOString(), agentId, action: 'QUARANTINE_ENABLED', reason });
      return { quarantined: true, agentId, tokensRevoked };
    }
    this.quarantinedAgents.delete(agentId);
    eventLedger.record({
      sessionId: `kill_switch_${agentId}`,
      type: 'KILL_SWITCH',
      agentId,
      action: 'released',
      data: { state: 'DEACTIVATED', reason: 'Quarantine lifted by security operator', quarantined: false },
    });
    this.killSwitchAuditEvents.unshift({ timestamp: new Date().toISOString(), agentId, action: 'QUARANTINE_LIFTED', reason: 'Restored by operator' });
    return { quarantined: false, agentId, tokensRevoked: 0 };
  }

  public getKillSwitchState(): { quarantinedAgents: string[]; recentEvents: unknown[] } {
    return {
      quarantinedAgents: Array.from(this.quarantinedAgents),
      recentEvents: this.killSwitchAuditEvents,
    };
  }

  /** Blast radius computed from the real event ledger of the incident's session. */
  public generateBlastRadiusGraph(incident: Pick<Incident, 'id'>): BlastRadiusGraph {
    return buildBlastRadius(eventLedger.bySession(incident.id), {
      incidentId: incident.id,
      sessionId: incident.id,
      outbox: protectedToolServer.getOutbox(),
      refunds: protectedToolServer.getRefunds(),
    });
  }

  /** Replay steps using the real event timestamps. */
  public generateTimeline(incident: Pick<Incident, 'id'>): ReplayTimelineStep[] {
    return buildTimeline(eventLedger.bySession(incident.id));
  }

  /** Report drafts populated from the computed graph and events (still drafts; no deadlines asserted). */
  public generateReportDrafts(incident: Pick<Incident, 'id'> & Partial<Incident>): IncidentReportDrafts {
    const events = eventLedger.bySession(incident.id);
    const graph = this.generateBlastRadiusGraph(incident);
    return buildReportDrafts(incident.id, events, graph, { scenarioTitle: incident.scenarioTitle, firewallMode: incident.firewallMode });
  }
}

export const incidentResponseEngine = new IncidentResponseEngine();
