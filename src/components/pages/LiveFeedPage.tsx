import React, { useState } from 'react';
import {
  Activity,
  Filter,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ArrowUpRight,
  Search,
  AlertTriangle,
  Send,
  Layers,
  Radio,
} from 'lucide-react';
import { Incident, OrgApp } from '../../../server/types.ts';

interface LiveFeedPageProps {
  incidents: Incident[];
  apps: OrgApp[];
  onSelectIncident: (id: string) => void;
  selectedAppFilter: string;
  onAppFilterChange: (appId: string) => void;
  onTriggerScenario: () => void;
}

export const LiveFeedPage: React.FC<LiveFeedPageProps> = ({
  incidents,
  apps,
  onSelectIncident,
  selectedAppFilter,
  onAppFilterChange,
  onTriggerScenario,
}) => {
  const [decisionFilter, setDecisionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredIncidents = incidents.filter((inc) => {
    // App filter
    if (selectedAppFilter !== 'all' && inc.appId !== selectedAppFilter) {
      return false;
    }

    // Decision filter
    if (decisionFilter === 'BLOCKED') {
      if (inc.decision.action !== 'deny') return false;
    } else if (decisionFilter === 'ALLOWED') {
      if (inc.decision.action !== 'allow' || inc.decision.shadowWouldBlock) return false;
    } else if (decisionFilter === 'APPROVAL') {
      if (inc.decision.action !== 'approve') return false;
    } else if (decisionFilter === 'SHADOW-WOULD-BLOCK') {
      if (!inc.decision.shadowWouldBlock || inc.firewallMode !== 'shadow') return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchReason = inc.decision.reason.toLowerCase().includes(q);
      const matchApp = (inc.appName || '').toLowerCase().includes(q);
      const matchTool = (inc.toolCall?.tool || '').toLowerCase().includes(q);
      const matchRule = inc.decision.ruleId.toLowerCase().includes(q);
      if (!matchReason && !matchApp && !matchTool && !matchRule) return false;
    }

    return true;
  });

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls Bar */}
      <div className="bg-surface border border-line rounded-lg rounded p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold text-fg uppercase tracking-wide">
                Live Event Stream &amp; Gateway Telemetry
              </h2>
              <span className="flex items-center gap-1.5 text-3xs font-mono text-accent bg-accent-solid/10 border border-line-strong px-2 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-solid inline-block" />
                SSE CONNECTED
              </span>
            </div>
            <p className="text-xs text-muted font-mono mt-0.5">
              Real-time inspection of inbound segments, risk heuristics, policy evaluation, and tool decisions.
            </p>
          </div>

          <button
            type="button"
            onClick={onTriggerScenario}
            className="px-3.5 py-1.5 bg-gradient-to-r from-accent-solid to-accent-solid hover:from-accent-solid hover:to-accent-solid text-on-solid text-xs font-mono font-black uppercase tracking-wider rounded transition-all flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
          >
            <span>Run New Scenario</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-on-solid" />
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search bar */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search rule, reason, or tool signature..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-canvas border border-line-strong rounded pl-9 pr-3 py-1.5 text-xs font-mono text-fg placeholder:text-muted focus:outline-none focus:border-accent-solid focus:ring-1 focus:ring-accent-solid/40"
            />
          </div>

          {/* App filter */}
          <div className="sm:col-span-4">
            <select
              value={selectedAppFilter}
              onChange={(e) => onAppFilterChange(e.target.value)}
              className="w-full bg-canvas border border-line-strong rounded px-3 py-1.5 text-xs font-mono text-accent focus:outline-none focus:border-accent-solid cursor-pointer"
            >
              <option value="all">ALL PROTECTED AGENTS (3)</option>
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Decision filter */}
          <div className="sm:col-span-3">
            <select
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
              className="w-full bg-canvas border border-line-strong rounded px-3 py-1.5 text-xs font-mono text-accent focus:outline-none focus:border-accent-solid cursor-pointer"
            >
              <option value="ALL">ALL DECISIONS</option>
              <option value="BLOCKED">BLOCKED ONLY</option>
              <option value="ALLOWED">ALLOWED ONLY</option>
              <option value="APPROVAL">APPROVAL ONLY</option>
              <option value="SHADOW-WOULD-BLOCK">SHADOW WOULD BLOCK</option>
            </select>
          </div>
        </div>
      </div>

      {/* Feed Stream Table */}
      <div className="bg-surface border border-line rounded-lg rounded overflow-hidden">
        <div className="bg-code px-4 py-3 border-b border-line flex items-center justify-between">
          <span className="text-xs font-semibold text-fg uppercase tracking-wider">
            Live Gateway Events ({filteredIncidents.length} Records)
          </span>
          <span className="text-3xs font-mono text-accent">[CLICK ROW TO EXPAND TELEMETRY]</span>
        </div>

        {filteredIncidents.length === 0 ? (
          <div className="p-12 text-center text-muted text-xs font-mono">
            <AlertTriangle className="w-6 h-6 text-warn mx-auto mb-2" />
            No events match the selected filters. Trigger an attack scenario above or clear filters.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filteredIncidents.map((inc) => {
              const isExpanded = expandedId === inc.id;
              const isBlocked = inc.decision.action === 'deny';
              const isApproval = inc.decision.action === 'approve';
              const isShadowBlock = inc.firewallMode === 'shadow' && inc.decision.shadowWouldBlock;

              return (
                <div key={inc.id} className="transition-colors hover:bg-raised">
                  {/* Summary Row */}
                  <div
                    onClick={() => toggleExpand(inc.id)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer text-xs"
                  >
                    <div className="flex items-start md:items-center gap-3">
                      <div className="mt-0.5 md:mt-0 text-muted">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-accent" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted" />
                        )}
                      </div>

                      {/* Status Chip */}
                      <div>
                        {isShadowBlock ? (
                          <span className="font-mono text-3xs font-black px-2 py-0.5 rounded bg-warn-solid/10 text-warn border border-warn-solid/40 uppercase">
                            SHADOW-WOULD-BLOCK
                          </span>
                        ) : isBlocked ? (
                          <span className="font-mono text-3xs font-black px-2 py-0.5 rounded bg-danger-solid/10 text-danger border border-danger-solid/40 uppercase ">
                            BLOCKED
                          </span>
                        ) : isApproval ? (
                          <span className="font-mono text-3xs font-black px-2 py-0.5 rounded bg-warn-solid/10 text-warn border border-warn-solid/40 uppercase">
                            APPROVAL
                          </span>
                        ) : (
                          <span className="font-mono text-3xs font-black px-2 py-0.5 rounded bg-ok-solid/10 text-ok border border-ok-solid/40 uppercase">
                            ALLOWED
                          </span>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-fg font-semibold">{inc.appName || 'Agent'}</span>
                          <span className="text-muted">//</span>
                          <span className="font-mono text-2xs text-accent font-semibold">{inc.decision.ruleId}</span>
                          {inc.isSeeded && (
                            <span className="text-3xs font-mono text-muted">[SEEDED]</span>
                          )}
                        </div>
                        <p className="text-2xs text-muted font-mono line-clamp-1">{inc.decision.reason}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right shrink-0">
                      <div>
                        <div className="font-mono text-2xs font-semibold text-fg2">
                          {inc.toolCall ? `${inc.toolCall.tool}()` : 'text_response'}
                        </div>
                        <div className="text-3xs text-muted font-mono">
                          {new Date(inc.timestamp).toLocaleTimeString()} · {inc.latency.totalMs}ms
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIncident(inc.id);
                        }}
                        className="px-2.5 py-1 rounded bg-surface hover:bg-raised text-accent text-2xs font-mono transition-colors flex items-center gap-1 border border-line cursor-pointer"
                      >
                        <span>HERO</span>
                        <ArrowUpRight className="w-3 h-3 text-accent" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Row Detail Drawer */}
                  {isExpanded && (
                    <div className="bg-code border-t border-line p-4 space-y-4 text-xs font-mono">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Prompt & Segments */}
                        <div className="bg-surface p-3 rounded border border-line space-y-2">
                          <div className="text-3xs font-bold uppercase tracking-wide text-muted flex items-center justify-between">
                            <span>Ingested In-Flight Segments</span>
                            <span className="text-accent">{inc.segments.length} segment(s)</span>
                          </div>
                          {inc.segments.map((s) => (
                            <div key={s.id} className="p-2 bg-code rounded border border-line text-2xs ">
                              <div className="flex items-center justify-between text-muted mb-1">
                                <span className="uppercase text-accent">[{s.trust}]</span>
                                <span>{s.labelSource}</span>
                              </div>
                              <pre className="text-fg2 whitespace-pre-wrap max-h-24 overflow-y-auto">
                                {s.content}
                              </pre>
                            </div>
                          ))}
                        </div>

                        {/* Findings & Proposed Tool Call */}
                        <div className="bg-surface p-3 rounded border border-line space-y-2">
                          <div className="text-3xs font-bold uppercase tracking-wide text-muted flex items-center justify-between">
                            <span>Risk Signals &amp; Tool Action</span>
                            <span className="text-danger">{inc.findings.length} Finding(s)</span>
                          </div>

                          {inc.findings.map((f) => (
                            <div key={f.id} className="p-2 bg-danger-solid/10 rounded border border-line text-2xs">
                              <div className="flex items-center justify-between text-fg2 mb-1">
                                <span className="font-semibold text-danger">{f.category}</span>
                                <span className="font-mono text-danger">{f.severity} ({Math.round(f.confidence * 100)}%)</span>
                              </div>
                              <div className="text-muted">{f.reason}</div>
                            </div>
                          ))}

                          {inc.toolCall && (
                            <div className="p-2 bg-code rounded border border-line text-2xs">
                              <div className="text-accent font-bold mb-1">Proposed Tool: {inc.toolCall.tool}()</div>
                              <pre className="text-fg2 whitespace-pre-wrap max-h-20 overflow-y-auto font-mono">
                                {JSON.stringify(inc.toolCall.args, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => onSelectIncident(inc.id)}
                          className="px-3.5 py-1.5 bg-accent-solid hover:brightness-110 text-on-solid font-black font-mono rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
                        >
                          <span>Open Hero Forensic Timeline</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-on-solid" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
