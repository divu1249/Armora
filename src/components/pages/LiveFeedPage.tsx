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
      <div className="cyber-card cyber-corner-tr rounded p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#00e5ff]/15 pb-4 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-[#00e5ff]" />
              <h2 className="text-sm font-bold font-heading text-white uppercase tracking-wide">
                Live Event Stream &amp; Gateway Telemetry
              </h2>
              <span className="flex items-center gap-1.5 text-3xs font-mono text-[#00e5ff] bg-[#00e5ff]/10 border border-[#00e5ff]/30 px-2 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-ping inline-block" />
                SSE CONNECTED
              </span>
            </div>
            <p className="text-xs text-[#8293aa] font-mono mt-0.5">
              Real-time inspection of inbound segments, risk heuristics, policy evaluation, and tool decisions.
            </p>
          </div>

          <button
            type="button"
            onClick={onTriggerScenario}
            className="px-3.5 py-1.5 bg-gradient-to-r from-[#00e5ff] to-[#00a8ff] hover:from-[#33ecff] hover:to-[#33b8ff] text-[#080b12] text-xs font-mono font-black uppercase tracking-wider rounded transition-all shadow-[0_0_12px_rgba(0,229,255,0.4)] flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
          >
            <span>Run New Scenario</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#080b12]" />
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search bar */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-[#8293aa] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search rule, reason, or tool signature..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#050810] border border-[#00e5ff]/30 rounded pl-9 pr-3 py-1.5 text-xs font-mono text-white placeholder-[#8293aa] focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff]/30"
            />
          </div>

          {/* App filter */}
          <div className="sm:col-span-4">
            <select
              value={selectedAppFilter}
              onChange={(e) => onAppFilterChange(e.target.value)}
              className="w-full bg-[#050810] border border-[#00e5ff]/30 rounded px-3 py-1.5 text-xs font-mono text-[#00e5ff] focus:outline-none focus:border-[#00e5ff] cursor-pointer"
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
              className="w-full bg-[#050810] border border-[#00e5ff]/30 rounded px-3 py-1.5 text-xs font-mono text-[#00e5ff] focus:outline-none focus:border-[#00e5ff] cursor-pointer"
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
      <div className="cyber-card rounded overflow-hidden">
        <div className="bg-[#050810] px-4 py-3 border-b border-[#00e5ff]/15 flex items-center justify-between">
          <span className="text-xs font-bold font-heading text-white uppercase tracking-wider">
            Live Gateway Events ({filteredIncidents.length} Records)
          </span>
          <span className="text-3xs font-mono text-[#00e5ff]">[CLICK ROW TO EXPAND TELEMETRY]</span>
        </div>

        {filteredIncidents.length === 0 ? (
          <div className="p-12 text-center text-[#8293aa] text-xs font-mono">
            <AlertTriangle className="w-6 h-6 text-[#ffb020] mx-auto mb-2" />
            No events match the selected filters. Trigger an attack scenario above or clear filters.
          </div>
        ) : (
          <div className="divide-y divide-[#00e5ff]/10">
            {filteredIncidents.map((inc) => {
              const isExpanded = expandedId === inc.id;
              const isBlocked = inc.decision.action === 'deny';
              const isApproval = inc.decision.action === 'approve';
              const isShadowBlock = inc.firewallMode === 'shadow' && inc.decision.shadowWouldBlock;

              return (
                <div key={inc.id} className="transition-colors hover:bg-[#141f33]/40">
                  {/* Summary Row */}
                  <div
                    onClick={() => toggleExpand(inc.id)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer text-xs"
                  >
                    <div className="flex items-start md:items-center gap-3">
                      <div className="mt-0.5 md:mt-0 text-[#8293aa]">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[#00e5ff]" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[#8293aa]" />
                        )}
                      </div>

                      {/* Status Chip */}
                      <div>
                        {isShadowBlock ? (
                          <span className="font-mono text-3xs font-black px-2 py-0.5 rounded bg-[#ffb020]/10 text-[#ffb020] border border-[#ffb020]/40 uppercase">
                            SHADOW-WOULD-BLOCK
                          </span>
                        ) : isBlocked ? (
                          <span className="font-mono text-3xs font-black px-2 py-0.5 rounded bg-[#ff365d]/10 text-[#ff365d] border border-[#ff365d]/40 uppercase glow-text-crimson">
                            BLOCKED
                          </span>
                        ) : isApproval ? (
                          <span className="font-mono text-3xs font-black px-2 py-0.5 rounded bg-[#ffb020]/10 text-[#ffb020] border border-[#ffb020]/40 uppercase">
                            APPROVAL
                          </span>
                        ) : (
                          <span className="font-mono text-3xs font-black px-2 py-0.5 rounded bg-[#00f5a0]/10 text-[#00f5a0] border border-[#00f5a0]/40 uppercase">
                            ALLOWED
                          </span>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-heading">{inc.appName || 'Agent'}</span>
                          <span className="text-[#8293aa]">//</span>
                          <span className="font-mono text-2xs text-[#00e5ff] font-semibold">{inc.decision.ruleId}</span>
                          {inc.isSeeded && (
                            <span className="text-3xs font-mono text-[#8293aa]">[SEEDED]</span>
                          )}
                        </div>
                        <p className="text-2xs text-[#8293aa] font-mono line-clamp-1">{inc.decision.reason}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right shrink-0">
                      <div>
                        <div className="font-mono text-2xs font-semibold text-slate-300">
                          {inc.toolCall ? `${inc.toolCall.tool}()` : 'text_response'}
                        </div>
                        <div className="text-3xs text-[#8293aa] font-mono">
                          {new Date(inc.timestamp).toLocaleTimeString()} · {inc.latency.totalMs}ms
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIncident(inc.id);
                        }}
                        className="px-2.5 py-1 rounded bg-[#090d18] hover:bg-[#141f33] text-[#00e5ff] text-2xs font-mono transition-colors flex items-center gap-1 border border-[#00e5ff]/20 cursor-pointer"
                      >
                        <span>HERO</span>
                        <ArrowUpRight className="w-3 h-3 text-[#00e5ff]" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Row Detail Drawer */}
                  {isExpanded && (
                    <div className="bg-[#050810] border-t border-[#00e5ff]/15 p-4 space-y-4 text-xs font-mono">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Prompt & Segments */}
                        <div className="bg-[#090d18] p-3 rounded border border-[#00e5ff]/15 space-y-2">
                          <div className="text-3xs font-bold uppercase tracking-wide text-[#8293aa] flex items-center justify-between">
                            <span>Ingested In-Flight Segments</span>
                            <span className="text-[#00e5ff]">{inc.segments.length} segment(s)</span>
                          </div>
                          {inc.segments.map((s) => (
                            <div key={s.id} className="p-2 bg-[#050810] rounded border border-[#00e5ff]/10 text-2xs scanlines-overlay">
                              <div className="flex items-center justify-between text-[#8293aa] mb-1">
                                <span className="uppercase text-[#00e5ff]">[{s.trust}]</span>
                                <span>{s.labelSource}</span>
                              </div>
                              <pre className="text-slate-300 whitespace-pre-wrap max-h-24 overflow-y-auto">
                                {s.content}
                              </pre>
                            </div>
                          ))}
                        </div>

                        {/* Findings & Proposed Tool Call */}
                        <div className="bg-[#090d18] p-3 rounded border border-[#00e5ff]/15 space-y-2">
                          <div className="text-3xs font-bold uppercase tracking-wide text-[#8293aa] flex items-center justify-between">
                            <span>Risk Signals &amp; Tool Action</span>
                            <span className="text-[#ff365d]">{inc.findings.length} Finding(s)</span>
                          </div>

                          {inc.findings.map((f) => (
                            <div key={f.id} className="p-2 bg-[#150a10] rounded border border-[#ff365d]/20 text-2xs">
                              <div className="flex items-center justify-between text-slate-300 mb-1">
                                <span className="font-semibold text-[#ff365d]">{f.category}</span>
                                <span className="font-mono text-[#ff365d]">{f.severity} ({Math.round(f.confidence * 100)}%)</span>
                              </div>
                              <div className="text-[#8293aa]">{f.reason}</div>
                            </div>
                          ))}

                          {inc.toolCall && (
                            <div className="p-2 bg-[#050810] rounded border border-[#00e5ff]/20 text-2xs">
                              <div className="text-[#00e5ff] font-bold mb-1">Proposed Tool: {inc.toolCall.tool}()</div>
                              <pre className="text-slate-300 whitespace-pre-wrap max-h-20 overflow-y-auto font-mono">
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
                          className="px-3.5 py-1.5 bg-[#00e5ff] hover:bg-[#33ecff] text-[#080b12] font-black font-mono rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
                        >
                          <span>Open Hero Forensic Timeline</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-[#080b12]" />
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
