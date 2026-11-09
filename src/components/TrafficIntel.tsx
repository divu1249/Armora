import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Activity,
  Layers,
  Filter,
  Users,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  fetchTrafficSeries,
  fetchRiskyAccounts,
  fetchDetectorHealth,
  markDetectorFalsePositive,
} from '../services/api.ts';

export const TrafficIntel: React.FC = () => {
  const [selectedApp, setSelectedApp] = useState<string>('all');
  const [series, setSeries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [detectors, setDetectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedApp]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [seriesData, accData, detData] = await Promise.all([
        fetchTrafficSeries(selectedApp),
        fetchRiskyAccounts(),
        fetchDetectorHealth(),
      ]);
      setSeries(seriesData.series);
      setAccounts(accData.accounts);
      setDetectors(detData.detectors);
    } catch (err) {
      console.error('Failed to load traffic intelligence:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkFalsePositive = async (detectorName: string) => {
    try {
      const res = await markDetectorFalsePositive(detectorName);
      setDetectors(res.detectors);
    } catch (err) {
      console.error('Failed to mark false positive:', err);
    }
  };

  // Recent 48 hours for graph display
  const recentPoints = series.slice(-48);
  const maxVal = Math.max(...recentPoints.map((p) => Math.max(p.blocks, p.upper95Band)), 12);

  return (
    <div className="space-y-6">
      {/* 1. 14-Day Hourly Anomaly Baseline View */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              Traffic Anomaly Detection (14-Day Hourly Window)
              <span className="text-2xs font-mono text-muted font-normal">
                [PRECOMPUTED: Negative-Binomial 95% Confidence Band]
              </span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Identifies traffic volume deviations from precomputed offline negative-binomial expected values.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted font-medium">Filter App:</span>
            <select
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              className="text-xs bg-subtle border border-line-strong rounded px-2.5 py-1.5 text-fg"
            >
              <option value="all">All Applications (Aggregated)</option>
              <option value="app-talent-portal">app-talent-portal (HR)</option>
              <option value="app-support-desk">app-support-desk (E-Commerce)</option>
              <option value="app-analytics-bot">app-analytics-bot (Reporting)</option>
            </select>
          </div>
        </div>

        {/* Precomputed Baseline Note */}
        <div className="mb-4 px-3 py-2 bg-subtle border border-line rounded text-2xs font-mono text-fg2 flex items-center justify-between">
          <span>Model: Negative-Binomial Offline Precomputed · Dispersion θ = 4.25 · Log-link offset</span>
          <span className="font-semibold text-fg2">Baseline precomputed offline; not live-fitted</span>
        </div>

        {/* SVG Time-Series Chart */}
        <div className="p-3 bg-subtle border border-line rounded-lg">
          <div className="flex items-center justify-between text-2xs font-mono text-muted mb-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-danger-solid/10 rounded-xs" /> Actual Blocks (Alerts)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-accent-solid/10 border border-accent-solid/40 rounded-xs" /> 95% Confidence Band
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-danger-solid" /> Statistical Anomaly
              </span>
            </div>
            <span>Displaying Last 48 Hourly Slots</span>
          </div>

          <div className="h-44 w-full relative">
            <svg role="img" aria-label="Request volume with confidence band" className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 480 140">
              {/* Grid Lines */}
              <line x1="0" y1="20" x2="480" y2="20" stroke="var(--c-line)" strokeDasharray="3 3" />
              <line x1="0" y1="70" x2="480" y2="70" stroke="var(--c-line)" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="480" y2="120" stroke="var(--c-line)" strokeDasharray="3 3" />

              {/* 95% Confidence Band Polygon */}
              <polygon
                fill="var(--c-accent-solid)" fillOpacity="0.15"
                points={
                  recentPoints
                    .map((p, i) => `${i * 10},${130 - (p.upper95Band / maxVal) * 110}`)
                    .join(' ') +
                  ' ' +
                  recentPoints
                    .slice()
                    .reverse()
                    .map((p, i) => `${(recentPoints.length - 1 - i) * 10},${130 - (p.lower95Band / maxVal) * 110}`)
                    .join(' ')
                }
              />

              {/* Expected Value Line */}
              <polyline
                fill="none"
                stroke="var(--c-accent)"
                strokeWidth="1.5"
                strokeDasharray="2 2"
                points={recentPoints.map((p, i) => `${i * 10},${130 - (p.expectedBlocks / maxVal) * 110}`).join(' ')}
              />

              {/* Actual Blocks Line */}
              <polyline
                fill="none"
                stroke="var(--c-danger)"
                strokeWidth="2"
                points={recentPoints.map((p, i) => `${i * 10},${130 - (p.blocks / maxVal) * 110}`).join(' ')}
              />

              {/* Anomaly Points */}
              {recentPoints.map((p, i) =>
                p.isAnomaly ? (
                  <circle
                    key={i}
                    cx={i * 10}
                    cy={130 - (p.blocks / maxVal) * 110}
                    r="4"
                    fill="var(--c-danger)"
                    stroke="var(--c-surface)"
                    strokeWidth="1.5"
                  />
                ) : null
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* 2. Risky-Account Ranking with Empirical-Bayes Shrinkage */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-2xs">
        <div className="border-b border-line pb-3 mb-4">
          <h3 className="text-sm font-bold text-fg flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            Empirical-Bayes Account Risk Ranking
            <span className="text-2xs font-mono text-muted font-normal">
              [BUILT: Posterior Shrinkage to Prevent Small-Sample Skew]
            </span>
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Shrinks raw block rates toward global prior Beta(α=3.2, β=18.5) so accounts with only 1–2 requests are not erroneously placed at the top of the risk leaderboard.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-subtle border-b border-line text-fg2 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Account / Principal</th>
                <th className="py-2.5 px-3">App Context</th>
                <th className="py-2.5 px-3">Total Volume</th>
                <th className="py-2.5 px-3">Blocked Actions</th>
                <th className="py-2.5 px-3">Raw Rate</th>
                <th className="py-2.5 px-3">EB Shrunk Risk Score</th>
                <th className="py-2.5 px-3">Risk Tier</th>
                <th className="py-2.5 px-3">Sample Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-mono text-2xs">
              {accounts.map((acc, idx) => (
                <tr key={acc.userId} className="hover:bg-subtle/50">
                  <td className="py-2.5 px-3 font-semibold text-fg font-sans">
                    #{idx + 1} {acc.userName}
                  </td>
                  <td className="py-2.5 px-3 text-fg2">{acc.appId}</td>
                  <td className="py-2.5 px-3 text-fg2 tabular-nums">{acc.totalRequests}</td>
                  <td className="py-2.5 px-3 text-danger font-bold tabular-nums">{acc.blockedRequests}</td>
                  <td className="py-2.5 px-3 text-muted tabular-nums">{acc.rawRate}%</td>
                  <td className="py-2.5 px-3 font-bold text-accent tabular-nums">
                    {acc.shrunkRiskScore}%
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold ${
                        acc.riskTier === 'HIGH'
                          ? 'bg-danger-solid/10 text-danger'
                          : acc.riskTier === 'MEDIUM'
                          ? 'bg-warn-solid/10 text-warn'
                          : 'bg-ok-solid/10 text-ok'
                      }`}
                    >
                      {acc.riskTier}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded font-sans text-3xs font-semibold ${
                        acc.sampleConfidence === 'STABLE'
                          ? 'bg-subtle text-fg2'
                          : 'bg-warn-solid/10 border border-warn-solid/40 text-warn'
                      }`}
                    >
                      {acc.sampleConfidence === 'LOW_SAMPLE' ? 'Low N (Shrunk Heavily)' : 'Stable N'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Detector Health & False-Positive Rate */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-2xs">
        <div className="border-b border-line pb-3 mb-4">
          <h3 className="text-sm font-bold text-fg flex items-center gap-2">
            <Activity className="w-4 h-4 text-ok" />
            Detector Health &amp; False-Positive Telemetry
            <span className="text-2xs font-mono text-muted font-normal">
              [BUILT: User-Feedback Tuned]
            </span>
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Tracks true-positive validation vs false-positive rates from reviewed incidents to guide heuristic refinement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {detectors.map((det) => (
            <div key={det.detectorName} className="p-3.5 bg-subtle border border-line rounded-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-2xs mb-1">
                  <span
                    className={`font-mono font-bold px-1.5 py-0.2 rounded text-3xs ${
                      det.status === 'HEALTHY' ? 'bg-ok-solid/10 text-ok' : 'bg-warn-solid/10 text-warn'
                    }`}
                  >
                    {det.status}
                  </span>
                  <span className="font-mono text-2xs text-muted">
                    FP Rate: <strong>{det.falsePositiveRate}%</strong>
                  </span>
                </div>
                <h4 className="text-xs font-bold text-fg mb-2">{det.detectorName}</h4>

                <div className="space-y-1 font-mono text-2xs text-fg2">
                  <div className="flex justify-between">
                    <span>Total Alerts Evaluated:</span>
                    <span className="font-bold text-fg">{det.totalAlerts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confirmed True Positives:</span>
                    <span className="font-bold text-ok">{det.confirmedTruePositives}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Marked False Positives:</span>
                    <span className="font-bold text-danger">{det.markedFalsePositives}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 mt-2 border-t border-line flex justify-end">
                <button
                  type="button"
                  onClick={() => handleMarkFalsePositive(det.detectorName)}
                  className="px-2 py-1 bg-surface hover:bg-subtle border border-line-strong rounded text-2xs font-semibold text-fg2 transition-colors"
                >
                  + Mark False Positive
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
