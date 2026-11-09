export interface AppConfig {
  production: boolean;
  demoMode: boolean;
  adminToken?: string;
  /** Bearer key required on /v1/* (mandatory in production) */
  gatewayKey?: string;
  appUrl?: string;
}

/** DEMO_MODE defaults to true locally and false in production. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const production = env.NODE_ENV === 'production';
  let demoMode = !production;
  if (env.DEMO_MODE !== undefined && env.DEMO_MODE !== '') demoMode = ['1', 'true', 'yes'].includes(env.DEMO_MODE.toLowerCase());

  let appUrl: string | undefined;
  if (env.APP_URL) {
    try {
      appUrl = new URL(env.APP_URL).origin;
    } catch {
      console.warn(`[config] APP_URL "${env.APP_URL}" is not a valid URL; CORS will allow same-origin only.`);
    }
  }
  return { production, demoMode, adminToken: env.ADMIN_TOKEN || undefined, gatewayKey: env.ARMORA_GATEWAY_KEY || undefined, appUrl };
}
