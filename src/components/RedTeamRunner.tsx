import React, { useEffect, useState } from 'react';
import { useOverlay } from '../ui/overlay.ts';
import {
  Crosshair,
  ShieldCheck,
  ShieldAlert,
  Play,
  RotateCcw,
  Download,
  Printer,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
  Search,
} from 'lucide-react';
import { FirewallMode } from '../../server/types.ts';
import {
  fetchRedTeamAttacks,
  runRedTeamSuite,
  runAdaptiveAttack,
  fetchReportHtml,
} from '../services/api.ts';

export const RedTeamRunner: React.FC = () => {
  const [attacks, setAttacks] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [suiteFirewallMode, setSuiteFirewallMode] = useState<FirewallMode>('enforce');
  const [suiteReport, setSuiteReport] = useState<any | null>(null);
  const [loadingSuite, setLoadingSuite] = useState(false);

  // Adaptive Attacker state
  const [selectedAdaptiveAttackId, setSelectedAdaptiveAttackId] = useState<string>('atk_01');
  const [maxAdaptiveAttempts, setMaxAdaptiveAttempts] = useState<number>(8);
  const [adaptiveReport, setAdaptiveReport] = useState<any | null>(null);
  const [loadingAdaptive, setLoadingAdaptive] = useState(false);

  // HTML Report Modal state
  const [htmlModalContent, setHtmlModalContent] = useState<string | null>(null);
  const htmlModalRef = useOverlay(htmlModalContent !== null, () => setHtmlModalContent(null));

  useEffect(() => {
    fetchRedTeamAttacks()
      .then((data) => setAttacks(data.attacks))
      .catch((err) => console.error('Failed to load attack library:', err));
  }, []);

  const handleRunSuite = async () => {
    setLoadingSuite(true);
    try {
      const data = await runRedTeamSuite(suiteFirewallMode);
      setSuiteReport(data.report);
    } catch (err) {
      console.error('Failed to run red-team suite:', err);
    } finally {
      setLoadingSuite(false);
    }
  };

  const handleRunAdaptive = async () => {
    setLoadingAdaptive(true);
    try {
      const data = await runAdaptiveAttack(selectedAdaptiveAttackId, maxAdaptiveAttempts);
      setAdaptiveReport(data.report);
    } catch (err) {
      console.error('Failed to run adaptive attacker:', err);
    } finally {
      setLoadingAdaptive(false);
    }
  };

  const handleExportJson = () => {
    if (!suiteReport) return;
    const blob = new Blob([JSON.stringify(suiteReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redteam_security_report_${suiteReport.firewallMode}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenPrintHtml = async () => {
    if (!suiteReport) return;
    try {
      const data = await fetchReportHtml(suiteReport);
      setHtmlModalContent(data.html);
    } catch (err) {
      console.error('Failed to generate HTML report:', err);
    }
  };

  const categories = [
    'ALL',
    'INSTRUCTION_OVERRIDE',
    'RECIPIENT_LIST',
    'CC_BCC',
    'DISPLAY_NAME',
    'IDN_LOOKALIKE',
    'UPI_MISMATCH',
    'TOKEN_ABUSE',
    'BENIGN_TASK',
    'ROLE_HIJACK',
    'INDIRECT_DOC',
    'INDIRECT_TOOL_OUTPUT',
    'EXFIL_MARKDOWN_IMAGE',
    'SECRET_REQUEST',
    'ENCODED_PAYLOAD',
    'SPLIT_ACROSS_SEGMENTS',
    'HINGLISH',
    'TOOL_DESCRIPTION_INJECTION',
  ];

  const filteredAttacks = attacks.filter((atk) => {
    const matchCat = activeCategory === 'ALL' || atk.category === activeCategory;
    const matchSearch =
      atk.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      atk.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Overview & Security Score Dashboard */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-danger" />
              Automated Red-Team Runner
              <span className="text-2xs font-mono text-muted font-normal">
                [SEEDED: synthetic attack + benign task set]
              </span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Empirical assessment suite testing model vulnerability vs Action Gate resilience. Proves that detectors produce advisory signals, but the Action Gate prevents harmful execution.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-line-strong p-0.5 bg-subtle text-2xs">
              <button
                type="button"
                onClick={() => setSuiteFirewallMode('enforce')}
                className={`py-1 px-2.5 rounded font-medium transition-colors ${
                  suiteFirewallMode === 'enforce' ? 'bg-accent-solid text-on-solid shadow-xs' : 'text-fg2'
                }`}
              >
                TEST ENFORCE
              </button>
              <button
                type="button"
                onClick={() => setSuiteFirewallMode('off')}
                className={`py-1 px-2.5 rounded font-medium transition-colors ${
                  suiteFirewallMode === 'off' ? 'bg-danger-solid text-on-solid shadow-xs' : 'text-fg2'
                }`}
              >
                TEST FIREWALL OFF
              </button>
            </div>

            <button
              type="button"
              disabled={loadingSuite}
              onClick={handleRunSuite}
              className="px-3.5 py-1.5 bg-accent-solid hover:brightness-110 disabled:bg-accent-solid/10 text-on-solid rounded text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {loadingSuite ? 'Evaluating seed set...' : 'Run Suite'}
            </button>
          </div>
        </div>

        {/* Security Score Cards (If suite was run) */}
        {suiteReport ? (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-lg border ${
                suiteReport.metrics.harmfulActionSuccessRate === 0
                  ? 'bg-ok-solid/10 border-ok-solid/40 text-ok'
                  : 'bg-danger-solid/10 border-danger-solid/40 text-danger'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide">
                  {suiteReport.metrics.harmfulActionSuccessRate === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-ok" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-danger" />
                  )}
                  <span>Evaluated Mode: {suiteReport.firewallMode.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="px-2 py-1 bg-surface border border-line-strong rounded text-2xs font-semibold text-fg2 hover:bg-subtle transition-colors flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenPrintHtml}
                    className="px-2 py-1 bg-surface border border-line-strong rounded text-2xs font-semibold text-fg2 hover:bg-subtle transition-colors flex items-center gap-1"
                  >
                    <Printer className="w-3 h-3" />
                    Printable HTML
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs font-medium">
                {suiteReport.thesisConclusion}
              </p>
            </div>

            <div className="text-2xs text-muted font-sans">
              On our seed set, n={suiteReport.sampleSize} ({suiteReport.harmfulAttacks} harmful, {suiteReport.benignAttacks} benign).
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 font-mono">
              <div className="p-3 bg-subtle border border-line rounded-md text-center">
                <div className="text-2xs text-muted font-sans">Harm Executed</div>
                <div className={`text-lg font-bold tabular-nums mt-0.5 ${suiteReport.metrics.harmfulActionsExecuted === 0 ? 'text-ok' : 'text-danger'}`}>
                  {suiteReport.metrics.harmfulActionsExecuted} ({suiteReport.metrics.harmfulActionSuccessRate}%)
                </div>
                <div className="text-3xs text-muted font-sans">Really executed on tool server</div>
              </div>
              <div className="p-3 bg-subtle border border-line rounded-md text-center">
                <div className="text-2xs text-muted font-sans">Blocked</div>
                <div className="text-lg font-bold text-fg tabular-nums mt-0.5">{suiteReport.metrics.blockedCount}</div>
                <div className="text-3xs text-muted font-sans">Denied by gate/verifier</div>
              </div>
              <div className="p-3 bg-subtle border border-line rounded-md text-center">
                <div className="text-2xs text-muted font-sans">Pending Approval</div>
                <div className="text-lg font-bold text-warn tabular-nums mt-0.5">{suiteReport.metrics.pendingApprovalCount}</div>
                <div className="text-3xs text-muted font-sans">Not counted as blocked</div>
              </div>
              <div className="p-3 bg-subtle border border-line rounded-md text-center">
                <div className="text-2xs text-muted font-sans">Detector Catch</div>
                <div className="text-lg font-bold text-fg tabular-nums mt-0.5">{suiteReport.metrics.detectorCatchRate}%</div>
                <div className="text-3xs text-muted font-sans">Heuristic, informational</div>
              </div>
              <div className="p-3 bg-subtle border border-line rounded-md text-center">
                <div className="text-2xs text-muted font-sans">Gate False Positives</div>
                <div className="text-lg font-bold text-fg tabular-nums mt-0.5">
                  {suiteReport.metrics.gateFalsePositiveCount} ({suiteReport.metrics.falsePositiveRate}%)
                </div>
                <div className="text-3xs text-muted font-sans">Benign tasks denied</div>
              </div>
              <div className="p-3 bg-subtle border border-line rounded-md text-center">
                <div className="text-2xs text-muted font-sans">Detector False Positives</div>
                <div className="text-lg font-bold text-warn tabular-nums mt-0.5">{suiteReport.metrics.detectorFalsePositiveCount}</div>
                <div className="text-3xs text-muted font-sans">Benign text flagged</div>
              </div>
              <div className="p-3 bg-subtle border border-line rounded-md text-center">
                <div className="text-2xs text-muted font-sans">Benign Completed</div>
                <div className="text-lg font-bold text-accent tabular-nums mt-0.5">{suiteReport.metrics.benignTaskCompletionRate}%</div>
                <div className="text-3xs text-muted font-sans">{suiteReport.metrics.benignNeedingApprovalCount} needed approval</div>
              </div>
              <div className="p-3 bg-subtle border border-line rounded-md text-center">
                <div className="text-2xs text-muted font-sans">Latency p50 / p95</div>
                <div className="text-lg font-bold text-fg tabular-nums mt-0.5">
                  {suiteReport.metrics.latencyP50} / {suiteReport.metrics.latencyP95} ms
                </div>
                <div className="text-3xs text-muted font-sans">Per-case, in-process</div>
              </div>
            </div>

            {suiteReport.results.some((r: any) => r.detectorFalsePositive) && (
              <div className="p-3 bg-warn-solid/10 border border-warn-solid/40 rounded-md text-xs text-warn">
                <strong>Detector false positives (benign tasks flagged):</strong>{' '}
                {suiteReport.results
                  .filter((r: any) => r.detectorFalsePositive)
                  .map((r: any) => `${r.attackId} ${r.attackName}`)
                  .join('; ')}
              </div>
            )}
            <ul className="list-disc pl-5 text-2xs text-muted space-y-0.5">
              {suiteReport.notes.map((n: string) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="p-4 bg-subtle border border-line rounded-md text-center text-xs text-muted">
            Click &ldquo;Run Suite&rdquo; to run the seed set (harmful and benign tasks) against an isolated tool server and measure what actually executes.
          </div>
        )}
      </div>

      {/* Adaptive Attacker Mode (Evidence for Thesis) */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-warn" />
              Adaptive Attacker Mutation Mode
              <span className="text-2xs font-mono text-muted font-normal">
                [BUILT: Multi-Turn Detector Bypass Experiment]
              </span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Simulates an adversarial query-loop mutating payloads (casing, synonyms, zero-width chars, base64) to evade detectors—and records what the Action Gate decides for each mutation (an illustration with a handful of mutations, not a proof).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedAdaptiveAttackId}
              onChange={(e) => setSelectedAdaptiveAttackId(e.target.value)}
              className="text-xs bg-subtle border border-line-strong rounded px-2.5 py-1.5 text-fg"
            >
              {attacks.slice(0, 10).map((atk) => (
                <option key={atk.id} value={atk.id}>
                  {atk.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={loadingAdaptive}
              onClick={handleRunAdaptive}
              className="px-3.5 py-1.5 bg-warn-solid hover:brightness-110 disabled:bg-warn-solid/10 text-on-solid rounded text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Crosshair className="w-3.5 h-3.5" />
              {loadingAdaptive ? 'Mutating...' : 'Run Adaptive Loop'}
            </button>
          </div>
        </div>

        {adaptiveReport ? (
          <div className="space-y-4">
            <div className="p-3.5 bg-code text-code-fg rounded-lg text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span className="font-semibold text-warn uppercase tracking-wide">
                  Thesis Outcome:{' '}
                </span>
                <span>{adaptiveReport.thesisVerification}</span>
              </div>
              <div className="font-mono text-2xs text-fg2 shrink-0">
                Queries to Detector Bypass:{' '}
                <span className="font-bold text-warn">
                  {adaptiveReport.queriesToDetectorBypass ? `Attempt #${adaptiveReport.queriesToDetectorBypass}` : 'None (All Caught)'}
                </span>
              </div>
            </div>

            <div className="border border-line rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-subtle border-b border-line text-fg2 font-semibold">
                  <tr>
                    <th className="py-2 px-3">Attempt #</th>
                    <th className="py-2 px-3">Mutation Strategy</th>
                    <th className="py-2 px-3">Mutated Text Preview</th>
                    <th className="py-2 px-3">Detector Status</th>
                    <th className="py-2 px-3">Action Gate Boundary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono text-2xs">
                  {adaptiveReport.attempts.map((att: any) => (
                    <tr key={att.attempt} className="hover:bg-subtle/50">
                      <td className="py-2 px-3 font-bold text-fg">#{att.attempt}</td>
                      <td className="py-2 px-3 font-semibold text-fg2 font-sans">{att.mutationType}</td>
                      <td className="py-2 px-3 text-fg2 truncate max-w-xs">{att.mutatedPrompt}</td>
                      <td className="py-2 px-3">
                        {att.detectorBypassed ? (
                          <span className="px-1.5 py-0.5 rounded bg-warn-solid/10 text-warn font-bold">
                            BYPASSED (Score: {att.detectorScore})
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-raised text-fg2">
                            CAUGHT (Score: {att.detectorScore})
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-ok-solid/10 text-ok font-bold">
                          GATE BLOCKED ({att.actionGateDecision.toUpperCase()})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-subtle border border-line rounded-md text-center text-xs text-muted">
            Select an attack above and run the adaptive loop to simulate automated detector evasion.
          </div>
        )}
      </div>

      {/* Synthetic Attack Library View */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3 mb-4">
          <h3 className="text-sm font-bold text-fg flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            Attack Library Catalog ({filteredAttacks.length} Vectors)
          </h3>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted" />
            <input
              type="text"
              placeholder="Search attacks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-subtle border border-line-strong rounded-md text-fg focus:outline-none focus:ring-1 focus:ring-accent-solid/40"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded text-2xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-accent-solid text-on-solid font-semibold shadow-xs'
                  : 'bg-subtle text-fg2 hover:bg-raised'
              }`}
            >
              {cat.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredAttacks.map((atk) => (
            <div key={atk.id} className="p-3.5 bg-subtle border border-line rounded-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-2xs mb-1">
                  <span className="font-mono font-bold text-accent">{atk.id}</span>
                  <span className="px-1.5 py-0.2 rounded bg-raised text-fg text-3xs font-semibold">
                    {atk.category}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-fg mb-1">{atk.name}</h4>
                <p className="text-xs text-fg2 mb-2 leading-relaxed">{atk.description}</p>
                <div className="p-2 bg-surface rounded border border-line text-2xs font-mono text-fg2 max-h-24 overflow-y-auto mb-2">
                  {atk.prompt}
                </div>
              </div>

              <div className="pt-2 border-t border-line text-3xs font-mono text-muted flex items-center justify-between">
                <span>Target Tool: <code className="text-accent font-bold">{atk.targetToolCall.tool}()</code></span>
                <span className={atk.isHarmful ? 'text-danger font-semibold' : 'text-ok font-semibold'}>
                  {atk.isHarmful ? 'Harmful' : 'Benign Control'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* HTML Report Modal */}
      {htmlModalContent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div ref={htmlModalRef} role="dialog" aria-modal="true" aria-label="Printable security assessment report" tabIndex={-1} className="bg-surface rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-subtle">
              <h4 className="text-sm font-bold text-fg">Printable Security Assessment Report</h4>
              <button
                type="button"
                onClick={() => setHtmlModalContent(null)}
                className="text-xs font-semibold text-muted hover:text-fg"
              >
                Close
              </button>
            </div>
            <iframe
              srcDoc={htmlModalContent}
              title="Printable Report"
              className="w-full flex-1 border-0 p-2"
            />
          </div>
        </div>
      )}
    </div>
  );
};
