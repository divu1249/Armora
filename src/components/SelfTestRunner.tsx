import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Play, ShieldAlert, Cpu } from 'lucide-react';
import { SelfTestReport } from '../../server/selfTest.ts';
import { runSelfTests } from '../services/api.ts';

export const SelfTestRunner: React.FC = () => {
  const [report, setReport] = useState<SelfTestReport | null>(null);
  const [loading, setLoading] = useState(false);

  const executeTests = async () => {
    setLoading(true);
    try {
      const data = await runSelfTests();
      setReport(data);
    } catch (err) {
      console.error('Failed to run self-tests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeTests();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Automated Self-Test &amp; Verification Suite
              <span className="text-2xs font-mono text-cyan-300 bg-cyan-950 border border-cyan-850 px-2 py-0.5 rounded">
                [BUILT: /selftest Endpoint]
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive test harness validating Verhoeff Aadhaar checksums, Luhn credit cards, single-use token replay rejection, hash-chain tamper detection, 10 policy evaluation vectors, and the regression suites for defects 0-9 (the same cases run under vitest).
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={executeTests}
            className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs shadow-sm transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Play className="w-3.5 h-3.5 fill-current text-slate-950" />
            <span>{loading ? 'Running Suite...' : 'Re-Run Verification Suite'}</span>
          </button>
        </div>

        {report && (
          <div
            className={`p-4 rounded-xl border mb-5 ${
              report.allPassed
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/40 border-rose-800 text-rose-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {report.allPassed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
                <span className="text-xs font-bold uppercase tracking-wide">
                  {report.allPassed ? 'ALL VERIFICATION TESTS PASSED' : 'TEST FAILURES DETECTED'}
                </span>
              </div>
              <div className="font-mono text-xs font-bold">
                {report.passedTests} / {report.totalTests} Passed{report.skippedTests ? `, ${report.skippedTests} skipped` : ''} (
                {Math.round((report.passedTests / report.totalTests) * 100)}%)
              </div>
            </div>
          </div>
        )}

        {report && (
          <div className="space-y-6">
            {Object.entries(report.suites).map(([suiteName, suiteData]) => (
              <div key={suiteName} className="border border-slate-800 rounded-xl overflow-hidden bg-[#0b1329]">
                <div className="bg-[#0f172a] px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wide">
                    {suiteName}
                  </span>
                  <span className="text-2xs font-mono font-semibold px-2 py-0.5 rounded bg-[#0b1329] border border-slate-700 text-cyan-300">
                    {suiteData.passed} / {suiteData.total} Passed
                  </span>
                </div>

                <div className="divide-y divide-slate-800/80">
                  {suiteData.results.map((r, idx) => (
                    <div key={idx} className="p-3 flex items-start justify-between gap-4 text-xs">
                      <div className="space-y-0.5">
                        <div className="font-medium text-slate-200 flex items-center gap-1.5">
                          {r.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )}
                          <span>{r.name}</span>
                        </div>
                        {r.details && (
                          <div className="text-2xs font-mono text-slate-400 pl-5">
                            {r.details}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`font-mono text-2xs font-bold px-2 py-0.5 rounded ${
                            r.passed
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {r.skipped ? 'SKIPPED' : r.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
