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
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">Live Event Stream &amp; Gateway Feed</h2>
              <span className="flex items-center gap-1.5 text-2xs font-mono text-cyan-400 bg-cyan-950/80 border border-cyan-800/40 px-2 py-0.5 rounded">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse inline-block" />
                SSE Connected
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time inspection of inbound segments, risk heuristics, policy evaluation, and tool decisions.
            </p>
          </div>

          <button
            type="button"
            onClick={onTriggerScenario}
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 self-start md:self-auto"
          >
            <span>Run New Scenario</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-950" />
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search bar */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search rule, reason, or tool..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0b1329] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* App filter */}
          <div className="sm:col-span-4">
            <select
              value={selectedAppFilter}
              onChange={(e) => onAppFilterChange(e.target.value)}
              className="w-full bg-[#0b1329] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Protected Apps (3)</option>
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>

          {/* Decision filter */}
          <div className="sm:col-span-3">
            <select
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
              className="w-full bg-[#0b1329] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Decisions</option>
              <option value="BLOCKED">BLOCKED</option>
              <option value="ALLOWED">ALLOWED</option>
              <option value="APPROVAL">APPROVAL</option>
              <option value="SHADOW-WOULD-BLOCK">SHADOW WOULD BLOCK</option>
            </select>
          </div>
        </div>
      </div>

      {/* Feed Stream Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-[#0d1629] px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Live Gateway Events ({filteredIncidents.length} Records)
          </span>
          <span className="text-2xs font-mono text-slate-400">Click any row to expand inspection details</span>
        </div>

        {filteredIncidents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <AlertTriangle className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            No events match the selected filters. Trigger an attack scenario above or clear filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredIncidents.map((inc) => {
              const isExpanded = expandedId === inc.id;
              const isBlocked = inc.decision.action === 'deny';
              const isApproval = inc.decision.action === 'approve';
              const isShadowBlock = inc.firewallMode === 'shadow' && inc.decision.shadowWouldBlock;

              return (
                <div key={inc.id} className="transition-colors hover:bg-slate-800/30">
                  {/* Summary Row */}
                  <div
                    onClick={() => toggleExpand(inc.id)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer text-xs"
                  >
                    <div className="flex items-start md:items-center gap-3">
                      <div className="mt-0.5 md:mt-0 text-slate-400">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </div>

                      {/* Status Chip */}
                      <div>
                        {isShadowBlock ? (
                          <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60 uppercase">
                            SHADOW-WOULD-BLOCK
                          </span>
                        ) : isBlocked ? (
                          <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/60 uppercase">
                            BLOCKED
                          </span>
                        ) : isApproval ? (
                          <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60 uppercase">
                            APPROVAL
                          </span>
                        ) : (
                          <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 uppercase">
                            ALLOWED
                          </span>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{inc.appName || 'Agent'}</span>
                          <span className="text-slate-500">·</span>
                          <span className="font-mono text-2xs text-cyan-400 font-semibold">{inc.decision.ruleId}</span>
                          {inc.isSeeded && (
                            <span className="text-2xs font-mono text-slate-500 font-normal">[SEEDED]</span>
                          )}
                        </div>
                        <p className="text-2xs text-slate-400 line-clamp-1">{inc.decision.reason}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right shrink-0">
                      <div>
                        <div className="font-mono text-2xs font-semibold text-slate-300">
                          {inc.toolCall ? `${inc.toolCall.tool}()` : 'text_response'}
                        </div>
                        <div className="text-2xs text-slate-500 font-mono">
                          {new Date(inc.timestamp).toLocaleTimeString()} · {inc.latency.totalMs}ms
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIncident(inc.id);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 text-2xs font-mono transition-colors flex items-center gap-1"
                      >
                        <span>Hero View</span>
                        <ArrowUpRight className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Row Detail Drawer */}
                  {isExpanded && (
                    <div className="bg-[#0b1329] border-t border-slate-800 p-4 space-y-4 text-xs font-mono">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Prompt & Segments */}
                        <div className="bg-[#0f172a] p-3 rounded-lg border border-slate-800 space-y-2">
                          <div className="text-2xs font-bold uppercase tracking-wide text-slate-400 flex items-center justify-between">
                            <span>Ingested In-Flight Segments</span>
                            <span className="text-cyan-400">{inc.segments.length} segment(s)</span>
                          </div>
                          {inc.segments.map((s) => (
                            <div key={s.id} className="p-2 bg-[#0b1329] rounded border border-slate-800 text-2xs">
                              <div className="flex items-center justify-between text-slate-400 mb-1">
                                <span className="uppercase text-white">[{s.trust}]</span>
                                <span>{s.labelSource}</span>
                              </div>
                              <pre className="text-slate-300 whitespace-pre-wrap max-h-24 overflow-y-auto">
                                {s.content}
                              </pre>
                            </div>
                          ))}
                        </div>

                        {/* Findings & Proposed Tool Call */}
                        <div className="bg-[#0f172a] p-3 rounded-lg border border-slate-800 space-y-2">
                          <div className="text-2xs font-bold uppercase tracking-wide text-slate-400 flex items-center justify-between">
                            <span>Risk Signals &amp; Tool Action</span>
                            <span className="text-rose-400">{inc.findings.length} Finding(s)</span>
                          </div>

                          {inc.findings.map((f) => (
                            <div key={f.id} className="p-2 bg-[#0b1329] rounded border border-slate-800 text-2xs">
                              <div className="flex items-center justify-between text-slate-300 mb-1">
                                <span className="font-semibold text-rose-300">{f.category}</span>
                                <span className="font-mono text-rose-400">{f.severity} ({Math.round(f.confidence * 100)}%)</span>
                              </div>
                              <div className="text-slate-400">{f.reason}</div>
                            </div>
                          ))}

                          {inc.toolCall && (
                            <div className="p-2 bg-[#0b1329] rounded border border-cyan-900/40 text-2xs">
                              <div className="text-cyan-300 font-bold mb-1">Proposed Tool: {inc.toolCall.tool}()</div>
                              <pre className="text-slate-300 whitespace-pre-wrap max-h-20 overflow-y-auto">
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
                          className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                        >
                          <span>Open Hero Incident Detail Timeline</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-950" />
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
