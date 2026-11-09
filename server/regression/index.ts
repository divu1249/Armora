import type { RegressionCase } from './helpers.ts';
import { buildCases } from './build.ts';
import { policyCases } from './policy.ts';
import { emailCases } from './email.ts';
import { sessionCases } from './session.ts';
import { brokerCases } from './broker.ts';
import { auditCases } from './audit.ts';
import { redteamCases } from './redteam.ts';
import { apiCases } from './api.ts';
import { geminiCases } from './gemini.ts';
import { readmeCases } from './readme.ts';

/** One source of truth: vitest iterates these AND /selftest includes the non-live ones. */
export const ALL_REGRESSION_CASES: RegressionCase[] = [
  ...buildCases,
  ...policyCases,
  ...emailCases,
  ...sessionCases,
  ...brokerCases,
  ...auditCases,
  ...redteamCases,
  ...apiCases,
  ...geminiCases,
  ...readmeCases,
];
export type { RegressionCase } from './helpers.ts';
