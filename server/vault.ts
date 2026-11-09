import crypto from 'node:crypto';

/**
 * Broker vault: the ONLY place upstream secrets (email provider, payments) live.
 * - Values come from env (EMAIL_PROVIDER_API_KEY / PAYMENTS_API_KEY) or are random per boot.
 * - There is deliberately no getter that returns a secret: the tool server can only
 *   `use()` a secret inside a callback, and what leaves the vault is an HMAC-derived receipt.
 * - Secrets never appear in agent context, logs, ledger events, API responses or the UI.
 * Honest limit: in this prototype the vault shares a process with the tool server and broker.
 */
export type VaultSecretName = 'email_provider_api_key' | 'payments_api_key';

const ENV_NAMES: Record<VaultSecretName, string> = {
  email_provider_api_key: 'EMAIL_PROVIDER_API_KEY',
  payments_api_key: 'PAYMENTS_API_KEY',
};

export interface VaultStatus {
  name: VaultSecretName;
  source: 'env' | 'random-per-boot';
  heldBy: 'broker-vault';
  exposedToAgents: false;
  useCount: number;
  lastUsedAt: string | null;
}

export class Vault {
  private secrets = new Map<VaultSecretName, string>();
  private meta = new Map<VaultSecretName, { source: 'env' | 'random-per-boot'; useCount: number; lastUsedAt: string | null }>();

  constructor(env: NodeJS.ProcessEnv = process.env) {
    for (const name of Object.keys(ENV_NAMES) as VaultSecretName[]) {
      const fromEnv = env[ENV_NAMES[name]];
      this.secrets.set(name, fromEnv || crypto.randomBytes(32).toString('hex'));
      this.meta.set(name, { source: fromEnv ? 'env' : 'random-per-boot', useCount: 0, lastUsedAt: null });
    }
  }

  /** Run `fn` with the secret. The secret must not be returned or logged by the caller. */
  public use<T>(name: VaultSecretName, fn: (secret: string) => T): T {
    const secret = this.secrets.get(name);
    if (!secret) throw new Error(`Unknown vault secret "${name}"`);
    const m = this.meta.get(name)!;
    m.useCount++;
    m.lastUsedAt = new Date().toISOString();
    return fn(secret);
  }

  /** Simulated upstream provider call: returns an HMAC-derived receipt, never the secret. */
  public callProvider(name: VaultSecretName, payload: string): string {
    return this.use(name, (secret) => crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16));
  }

  public status(): VaultStatus[] {
    return (Array.from(this.secrets.keys()) as VaultSecretName[]).map((name) => {
      const m = this.meta.get(name)!;
      return { name, source: m.source, heldBy: 'broker-vault', exposedToAgents: false, useCount: m.useCount, lastUsedAt: m.lastUsedAt };
    });
  }

  /**
   * Leak scan helper for tests and the inventory page: returns the names of secrets whose
   * value occurs anywhere inside `haystack`. (Compares against held values internally.)
   */
  public findLeaks(haystack: string): VaultSecretName[] {
    const out: VaultSecretName[] = [];
    for (const [name, value] of this.secrets) if (value.length >= 8 && haystack.includes(value)) out.push(name);
    return out;
  }
}

export const vault = new Vault();
