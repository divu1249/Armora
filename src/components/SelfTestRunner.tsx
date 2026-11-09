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
      <div className="bg-surface border border-line rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent" />
              Automated Self-Test &amp; Verification Suite
              <span className="text-2xs font-mono text-accent bg-accent-solid border border-accent-solid/40 px-2 py-0.5 rounded">
                [BUILT: /selftest Endpoint]
              </span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Comprehensive test harness validating Verhoeff Aadhaar checksums, Luhn credit cards, single-use token replay rejection, hash-chain tamper detection, 10 policy evaluation vectors, and the regression suites for defects 0-9 (the same cases run under vitest).
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={executeTests}
            className="px-3.5 py-1.5 bg-accent-solid/10 hover:bg-accent-solid/10 text-fg font-semibold rounded-lg text-xs shadow-sm transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Play className="w-3.5 h-3.5 fill-current text-fg" />
            <span>{loading ? 'Running Suite...' : 'Re-Run Verification Suite'}</span>
          </button>
        </div>

        {report && (
          <div
            className={`p-4 rounded-xl border mb-5 ${
              report.allPassed
                ? 'bg-ok-solid/10 border-ok-solid/40 text-ok'
                : 'bg-danger-solid/10 border-danger-solid/40 text-danger'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {report.allPassed ? (
                  <CheckCircle2 className="w-5 h-5 text-ok" />
                ) : (
                  <XCircle className="w-5 h-5 text-danger" />
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
              <div key={suiteName} className="border border-line rounded-xl overflow-hidden bg-subtle">
                <div className="bg-surface px-4 py-2.5 border-b border-line flex items-center justify-between">
                  <span className="text-xs font-bold text-fg uppercase tracking-wide">
                    {suiteName}
                  </span>
                  <span className="text-2xs font-mono font-semibold px-2 py-0.5 rounded bg-subtle border border-line-strong text-accent">
                    {suiteData.passed} / {suiteData.total} Passed
                  </span>
                </div>

                <div className="divide-y divide-line">
                  {suiteData.results.map((r, idx) => (
                    <div key={idx} className="p-3 flex items-start justify-between gap-4 text-xs">
                      <div className="space-y-0.5">
                        <div className="font-medium text-fg flex items-center gap-1.5">
                          {r.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-ok shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-danger shrink-0" />
                          )}
                          <span>{r.name}</span>
                        </div>
                        {r.details && (
                          <div className="text-2xs font-mono text-muted pl-5">
                            {r.details}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`font-mono text-2xs font-bold px-2 py-0.5 rounded ${
                            r.passed
                              ? 'bg-ok-solid text-ok border border-ok-solid/40'
                              : 'bg-danger-solid text-danger border border-danger-solid/40'
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
