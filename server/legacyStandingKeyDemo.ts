import crypto from 'node:crypto';
import { safeEqual } from './canonical.ts';
import type { ToolCall, ToolResult } from './types.ts';
import type { ProtectedToolServer } from './protectedTools.ts';

/**
 * ISOLATED, DEMO-ONLY module. It illustrates the OLD pattern (an agent process holding a
 * standing, unscoped, non-expiring key). It is used only by the firewall=OFF scenario and is
 * NOT part of the real verification path: ProtectedToolServer.executeTool() has no master-key
 * branch and does not accept any "firewall off" flag.
 * The key is random per boot; nothing about it is hard-coded.
 */
export const LEGACY_LABEL = 'Simulation of the legacy pattern';

export class LegacyStandingKeyDemo {
  private readonly key = `legacy_demo_${crypto.randomBytes(32).toString('hex')}`;

  /** What a legacy agent would hold in memory. */
  public presentKey(): string {
    return this.key;
  }

  public verifyKey(candidate: string): boolean {
    return typeof candidate === 'string' && safeEqual(candidate, this.key);
  }

  public execute(toolCall: ToolCall, toolServer: ProtectedToolServer, sessionId?: string): ToolResult {
    return toolServer.executeLegacySimulation(toolCall, this.presentKey(), (c) => this.verifyKey(c), sessionId);
  }
}

export const legacyStandingKeyDemo = new LegacyStandingKeyDemo();
