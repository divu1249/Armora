import { eventLedger } from './ledger.ts';
import { credentialBroker, tokenVerifier } from './credentialBroker.ts';
import { protectedToolServer } from './protectedTools.ts';
import { policyEngine } from './policyEngine.ts';
import { legacyStandingKeyDemo } from './legacyStandingKeyDemo.ts';
import { incidentResponseEngine } from './incidentResponse.ts';
import { ExecutionService } from './executionService.ts';

/**
 * Process-wide wiring: the broker and verifier report to the event ledger, and the single
 * ExecutionService instance (the only path to protected tools) is built from the singletons.
 */
const observer = eventLedger.credentialObserver();
credentialBroker.observer = observer;
tokenVerifier.observer = {
  ...observer,
  onRedeemed: (c) => {
    credentialBroker.markRedeemed(c.jti);
    observer.onRedeemed?.(c);
  },
};

const expirySweeper = setInterval(() => credentialBroker.sweepExpired(), 5000);
expirySweeper.unref?.();

export const executionService = new ExecutionService({
  ledger: eventLedger,
  broker: credentialBroker,
  verifier: tokenVerifier,
  toolServer: protectedToolServer,
  engine: policyEngine,
  legacy: legacyStandingKeyDemo,
  isQuarantined: (agentId) => incidentResponseEngine.isAgentQuarantined(agentId),
});
