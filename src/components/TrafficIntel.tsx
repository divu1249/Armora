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
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Traffic Anomaly Detection (14-Day Hourly Window)
              <span className="text-2xs font-mono text-slate-500 font-normal">
                [PRECOMPUTED: Negative-Binomial 95% Confidence Band]
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Identifies traffic volume deviations from precomputed offline negative-binomial expected values.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Filter App:</span>
            <select
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800"
            >
              <option value="all">All Applications (Aggregated)</option>
              <option value="app-talent-portal">app-talent-portal (HR)</option>
              <option value="app-support-desk">app-support-desk (E-Commerce)</option>
              <option value="app-analytics-bot">app-analytics-bot (Reporting)</option>
            </select>
          </div>
        </div>

        {/* Precomputed Baseline Note */}
        <div className="mb-4 px-3 py-2 bg-slate-100 border border-slate-200 rounded text-2xs font-mono text-slate-600 flex items-center justify-between">
          <span>Model: Negative-Binomial Offline Precomputed · Dispersion θ = 4.25 · Log-link offset</span>
          <span className="font-semibold text-slate-700">Baseline precomputed offline; not live-fitted</span>
        </div>

        {/* SVG Time-Series Chart */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-center justify-between text-2xs font-mono text-slate-500 mb-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-xs" /> Actual Blocks (Alerts)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-indigo-200 border border-indigo-400 rounded-xs" /> 95% Confidence Band
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600" /> Statistical Anomaly
              </span>
            </div>
            <span>Displaying Last 48 Hourly Slots</span>
          </div>

          <div className="h-44 w-full relative">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 480 140">
              {/* Grid Lines */}
              <line x1="0" y1="20" x2="480" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="0" y1="70" x2="480" y2="70" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="480" y2="120" stroke="#e2e8f0" strokeDasharray="3 3" />

              {/* 95% Confidence Band Polygon */}
              <polygon
                fill="#e0e7ff"
                fillOpacity="0.5"
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
                stroke="#6366f1"
                strokeWidth="1.5"
                strokeDasharray="2 2"
                points={recentPoints.map((p, i) => `${i * 10},${130 - (p.expectedBlocks / maxVal) * 110}`).join(' ')}
              />

              {/* Actual Blocks Line */}
              <polyline
                fill="none"
                stroke="#e11d48"
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
                    fill="#e11d48"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                ) : null
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* 2. Risky-Account Ranking with Empirical-Bayes Shrinkage */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="border-b border-slate-200 pb-3 mb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            Empirical-Bayes Account Risk Ranking
            <span className="text-2xs font-mono text-slate-500 font-normal">
              [BUILT: Posterior Shrinkage to Prevent Small-Sample Skew]
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Shrinks raw block rates toward global prior Beta(α=3.2, β=18.5) so accounts with only 1–2 requests are not erroneously placed at the top of the risk leaderboard.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
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
            <tbody className="divide-y divide-slate-100 font-mono text-2xs">
              {accounts.map((acc, idx) => (
                <tr key={acc.userId} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-semibold text-slate-900 font-sans">
                    #{idx + 1} {acc.userName}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{acc.appId}</td>
                  <td className="py-2.5 px-3 text-slate-700 tabular-nums">{acc.totalRequests}</td>
                  <td className="py-2.5 px-3 text-rose-700 font-bold tabular-nums">{acc.blockedRequests}</td>
                  <td className="py-2.5 px-3 text-slate-500 tabular-nums">{acc.rawRate}%</td>
                  <td className="py-2.5 px-3 font-bold text-indigo-700 tabular-nums">
                    {acc.shrunkRiskScore}%
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold ${
                        acc.riskTier === 'HIGH'
                          ? 'bg-rose-100 text-rose-800'
                          : acc.riskTier === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {acc.riskTier}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded font-sans text-3xs font-semibold ${
                        acc.sampleConfidence === 'STABLE'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-amber-50 border border-amber-200 text-amber-900'
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
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="border-b border-slate-200 pb-3 mb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            Detector Health &amp; False-Positive Telemetry
            <span className="text-2xs font-mono text-slate-500 font-normal">
              [BUILT: User-Feedback Tuned]
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tracks true-positive validation vs false-positive rates from reviewed incidents to guide heuristic refinement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {detectors.map((det) => (
            <div key={det.detectorName} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-2xs mb-1">
                  <span
                    className={`font-mono font-bold px-1.5 py-0.2 rounded text-3xs ${
                      det.status === 'HEALTHY' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {det.status}
                  </span>
                  <span className="font-mono text-2xs text-slate-500">
                    FP Rate: <strong>{det.falsePositiveRate}%</strong>
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mb-2">{det.detectorName}</h4>

                <div className="space-y-1 font-mono text-2xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Total Alerts Evaluated:</span>
                    <span className="font-bold text-slate-800">{det.totalAlerts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confirmed True Positives:</span>
                    <span className="font-bold text-emerald-700">{det.confirmedTruePositives}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Marked False Positives:</span>
                    <span className="font-bold text-rose-700">{det.markedFalsePositives}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 mt-2 border-t border-slate-200/80 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleMarkFalsePositive(det.detectorName)}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-2xs font-semibold text-slate-700 transition-colors"
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
