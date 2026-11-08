import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TrafficCoefficients {
  modelType: string;
  baselineNote: string;
  dispersionParameterTheta: number;
  intercept: number;
  hourEffects: Record<string, number>;
  weekdayEffects: Record<string, number>;
  appEffects: Record<string, number>;
  userPriors: { alpha: number; beta: number };
}

export interface HourlyTrafficPoint {
  timestamp: string;
  hourIndex: number;
  dayOfWeek: number;
  appId: string;
  requests: number;
  flags: number;
  blocks: number;
  expectedBlocks: number;
  upper95Band: number;
  lower95Band: number;
  isAnomaly: boolean;
  anomalyReason?: string;
}

export interface AccountRiskRank {
  userId: string;
  userName: string;
  appId: string;
  totalRequests: number;
  blockedRequests: number;
  rawRate: number; // Y / N
  shrunkRiskScore: number; // Empirical-Bayes posterior mean
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH';
  sampleConfidence: 'STABLE' | 'LOW_SAMPLE';
}

export interface DetectorHealthMetric {
  detectorName: string;
  totalAlerts: number;
  confirmedTruePositives: number;
  markedFalsePositives: number;
  falsePositiveRate: number; // percentage
  status: 'HEALTHY' | 'NEEDS_TUNING';
}

export class TrafficIntelligenceEngine {
  private coefficients: TrafficCoefficients;
  private timeSeriesData: HourlyTrafficPoint[] = [];
  private userAccounts: Array<{ id: string; name: string; appId: string; requests: number; blocks: number }> = [];
  private detectorFalsePositives: Map<string, { total: number; falsePositives: number }> = new Map();

  constructor() {
    const rawCoeffs = fs.readFileSync(path.resolve(__dirname, 'data/trafficCoefficients.json'), 'utf-8');
    this.coefficients = JSON.parse(rawCoeffs) as TrafficCoefficients;
    this.seed14DayTimeSeries();
    this.seedAccounts();
    this.seedDetectorHealth();
  }

  private seed14DayTimeSeries(): void {
    this.timeSeriesData = [];
    const apps = ['app-talent-portal', 'app-support-desk', 'app-analytics-bot'];
    const now = Date.now();
    const hoursTotal = 14 * 24; // 336 hours

    for (let h = 0; h < hoursTotal; h++) {
      const timeMs = now - (hoursTotal - h) * 3600 * 1000;
      const date = new Date(timeMs);
      const hour = date.getUTCHours();
      const dayOfWeek = date.getUTCDay();

      for (const appId of apps) {
        // Compute negative binomial expected value from precomputed offline coefficients
        const b0 = this.coefficients.intercept;
        const bHour = this.coefficients.hourEffects[String(hour)] ?? 0;
        const bDay = this.coefficients.weekdayEffects[String(dayOfWeek)] ?? 0;
        const bApp = this.coefficients.appEffects[appId] ?? 0;

        // Base traffic volume
        const baseRate = Math.max(10, Math.round(Math.exp(3.5 + bHour * 0.4 + bDay * 0.2 + bApp)));
        const requests = baseRate + Math.floor(Math.sin(h * 0.1) * 5);

        // Expected blocks rate
        const logMu = b0 + bHour + bDay + bApp + Math.log(Math.max(1, requests * 0.08));
        const expectedBlocks = Math.max(0.2, Number(Math.exp(logMu).toFixed(2)));

        const theta = this.coefficients.dispersionParameterTheta;
        const variance = expectedBlocks + Math.pow(expectedBlocks, 2) / theta;
        const stdDev = Math.sqrt(variance);
        const upper95 = Number((expectedBlocks + 1.96 * stdDev).toFixed(2));
        const lower95 = Math.max(0, Number((expectedBlocks - 1.96 * stdDev).toFixed(2)));

        // Actual blocks with injected anomalies on day 11 & 13
        let actualBlocks = Math.round(expectedBlocks + (Math.sin(h + hour) > 0.5 ? 1 : 0));
        let isAnomaly = false;
        let anomalyReason: string | undefined;

        // Injected attack burst on app-talent-portal at hour index 280 (Day 11)
        if (appId === 'app-talent-portal' && h >= 280 && h <= 283) {
          actualBlocks = Math.round(upper95 * 3.5);
          isAnomaly = true;
          anomalyReason = 'Sudden spike: Operation GhostResume injection burst';
        }

        // Injected attack anomaly on app-support-desk at hour index 320 (Day 13)
        if (appId === 'app-support-desk' && h === 320) {
          actualBlocks = Math.round(upper95 * 2.8);
          isAnomaly = true;
          anomalyReason = 'Sudden spike: Automated refund redirection volume';
        }

        const flags = Math.round(actualBlocks * 1.4);

        this.timeSeriesData.push({
          timestamp: date.toISOString(),
          hourIndex: h,
          dayOfWeek,
          appId,
          requests,
          flags,
          blocks: actualBlocks,
          expectedBlocks,
          upper95Band: upper95,
          lower95Band: lower95,
          isAnomaly,
          anomalyReason,
        });
      }
    }
  }

  private seedAccounts(): void {
    this.userAccounts = [
      { id: 'usr_sec_01', name: 'Aarav Mehta (External Vendor)', appId: 'app-talent-portal', requests: 450, blocks: 38 },
      { id: 'usr_sec_02', name: 'Priya N. (Agency Recruiter)', appId: 'app-talent-portal', requests: 120, blocks: 2 },
      { id: 'usr_sec_03', name: 'Unknown Temp Session #99', appId: 'app-support-desk', requests: 2, blocks: 2 }, // Low volume, high rate! (Candidate for shrinkage)
      { id: 'usr_sec_04', name: 'Kavita Das (Support Lead)', appId: 'app-support-desk', requests: 1850, blocks: 15 },
      { id: 'usr_sec_05', name: 'Automated Courier Hook', appId: 'app-support-desk', requests: 620, blocks: 44 },
      { id: 'usr_sec_06', name: 'Dev Testing Token #4', appId: 'app-analytics-bot', requests: 80, blocks: 1 },
      { id: 'usr_sec_07', name: 'Rohan V. (Internal Architect)', appId: 'app-talent-portal', requests: 520, blocks: 3 },
      { id: 'usr_sec_08', name: 'Sneha R. (Operations)', appId: 'app-support-desk', requests: 940, blocks: 8 },
      { id: 'usr_sec_09', name: 'Analytics Scraper Service', appId: 'app-analytics-bot', requests: 2100, blocks: 105 },
      { id: 'usr_sec_10', name: 'Single-Ping Probe 198.51', appId: 'app-talent-portal', requests: 1, blocks: 1 }, // 100% raw rate, but 1 request!
      { id: 'usr_sec_11', name: 'HR Senior Associate #12', appId: 'app-talent-portal', requests: 340, blocks: 4 },
      { id: 'usr_sec_12', name: 'E-Comm Batch Ingestion', appId: 'app-support-desk', requests: 1500, blocks: 12 },
    ];
  }

  private seedDetectorHealth(): void {
    this.detectorFalsePositives.set('Prompt Injection Heuristics', { total: 140, falsePositives: 4 });
    this.detectorFalsePositives.set('Hinglish Injection Heuristics (Seed Set)', { total: 35, falsePositives: 2 });
    this.detectorFalsePositives.set('PII Detector (Verhoeff Aadhaar)', { total: 85, falsePositives: 1 });
    this.detectorFalsePositives.set('PII Detector (Income Tax PAN)', { total: 72, falsePositives: 3 });
    this.detectorFalsePositives.set('Output Exfiltration Detector (Markdown Image)', { total: 28, falsePositives: 2 });
    this.detectorFalsePositives.set('System Prompt Canary Detector', { total: 18, falsePositives: 0 });
  }

  public getTimeSeries(appId?: string): HourlyTrafficPoint[] {
    if (appId && appId !== 'all') {
      return this.timeSeriesData.filter((d) => d.appId === appId);
    }
    return this.timeSeriesData;
  }

  /**
   * Empirical-Bayes shrinkage ranking:
   * Prior: Beta(alpha, beta) from offline coefficients
   * Posterior mean: r_i = (Y_i + alpha) / (N_i + alpha + beta)
   * Prevents 1-request 1-block accounts from leaping to #1 spot.
   */
  public getRiskyAccounts(): AccountRiskRank[] {
    const { alpha, beta } = this.coefficients.userPriors;

    const ranked: AccountRiskRank[] = this.userAccounts.map((u) => {
      const rawRate = u.requests > 0 ? u.blocks / u.requests : 0;
      // Empirical-Bayes shrinkage formula:
      const shrunkRiskScore = Number(((u.blocks + alpha) / (u.requests + alpha + beta)).toFixed(4));
      const sampleConfidence = u.requests < 15 ? 'LOW_SAMPLE' : 'STABLE';

      let riskTier: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (shrunkRiskScore > 0.08) riskTier = 'HIGH';
      else if (shrunkRiskScore > 0.03) riskTier = 'MEDIUM';

      return {
        userId: u.id,
        userName: u.name,
        appId: u.appId,
        totalRequests: u.requests,
        blockedRequests: u.blocks,
        rawRate: Number((rawRate * 100).toFixed(1)),
        shrunkRiskScore: Number((shrunkRiskScore * 100).toFixed(2)),
        riskTier,
        sampleConfidence,
      };
    });

    return ranked.sort((a, b) => b.shrunkRiskScore - a.shrunkRiskScore);
  }

  public getDetectorHealth(): DetectorHealthMetric[] {
    const result: DetectorHealthMetric[] = [];
    for (const [name, stats] of this.detectorFalsePositives.entries()) {
      const fpRate = stats.total > 0 ? Number(((stats.falsePositives / stats.total) * 100).toFixed(1)) : 0;
      result.push({
        detectorName: name,
        totalAlerts: stats.total,
        confirmedTruePositives: stats.total - stats.falsePositives,
        markedFalsePositives: stats.falsePositives,
        falsePositiveRate: fpRate,
        status: fpRate <= 5.0 ? 'HEALTHY' : 'NEEDS_TUNING',
      });
    }
    return result;
  }

  public markDetectorFalsePositive(detectorName: string): boolean {
    const stats = this.detectorFalsePositives.get(detectorName);
    if (stats) {
      stats.falsePositives++;
      stats.total++;
      return true;
    }
    this.detectorFalsePositives.set(detectorName, { total: 1, falsePositives: 1 });
    return true;
  }
}

export const trafficIntelligenceEngine = new TrafficIntelligenceEngine();
