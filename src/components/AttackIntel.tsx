import React, { useEffect, useState } from 'react';
import { useOverlay } from '../ui/overlay.ts';
import {
  Globe,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Download,
  Plus,
  Radio,
  Clock,
  Layers,
  Lock,
  Search,
} from 'lucide-react';
import {
  enrichIndicator,
  fetchCampaigns,
  fetchBlocklist,
  addBlocklistEntry,
  approveBlocklistEntry,
  allowlistEntry,
  exportStixJson,
} from '../services/api.ts';

export const AttackIntel: React.FC = () => {
  const [indicatorQuery, setIndicatorQuery] = useState('attacker@external-leak.com');
  const [enrichment, setEnrichment] = useState<any | null>(null);
  const [loadingEnrichment, setLoadingEnrichment] = useState(false);

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [blocklist, setBlocklist] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const addModalRef = useOverlay(showAddModal, () => setShowAddModal(false));

  // New Blocklist Entry Form state
  const [newIndicator, setNewIndicator] = useState('');
  const [newType, setNewType] = useState('domain');
  const [newScope, setNewScope] = useState('organization');
  const [newMode, setNewMode] = useState('block');
  const [newTtl, setNewTtl] = useState(720);
  const [newAppealNote, setNewAppealNote] = useState('');

  useEffect(() => {
    loadEnrichment(indicatorQuery);
    loadCampaigns();
    loadBlocklist();
  }, []);

  const loadEnrichment = async (ind: string) => {
    setLoadingEnrichment(true);
    try {
      const data = await enrichIndicator(ind);
      setEnrichment(data.enrichment);
    } catch (err) {
      console.error('Failed to load enrichment:', err);
    } finally {
      setLoadingEnrichment(false);
    }
  };

  const loadCampaigns = async () => {
    try {
      const data = await fetchCampaigns();
      setCampaigns(data.campaigns);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    }
  };

  const loadBlocklist = async () => {
    try {
      const data = await fetchBlocklist();
      setBlocklist(data.blocklist);
    } catch (err) {
      console.error('Failed to load blocklist:', err);
    }
  };

  const handleCreateBlocklistEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIndicator.trim()) return;
    try {
      await addBlocklistEntry({
        indicator: newIndicator.trim(),
        type: newType,
        scope: newScope,
        mode: newMode,
        ttlHours: newTtl,
        appealNote: newAppealNote,
      });
      setShowAddModal(false);
      setNewIndicator('');
      setNewAppealNote('');
      await loadBlocklist();
    } catch (err) {
      console.error('Failed to create blocklist entry:', err);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveBlocklistEntry(id, 'soc-lead@company.internal');
      await loadBlocklist();
    } catch (err) {
      console.error('Failed to approve entry:', err);
    }
  };

  const handleAllowlist = async (id: string) => {
    try {
      await allowlistEntry(id);
      await loadBlocklist();
    } catch (err) {
      console.error('Failed to allowlist entry:', err);
    }
  };

  const handleExportStix = async () => {
    try {
      const stix = await exportStixJson();
      const blob = new Blob([JSON.stringify(stix, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stix_bundle_threat_intel_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export STIX JSON:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Source Indicator Mock Enrichment Panel */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <Globe className="w-4 h-4 text-accent" />
              Source &amp; Indicator Enrichment
              <span className="text-2xs font-mono text-muted font-normal">
                [MOCK ENRICHMENT: Local Synthetic Table]
              </span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Enriches network and payload indicators without identity attribution or external lookups.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={indicatorQuery}
              onChange={(e) => setIndicatorQuery(e.target.value)}
              placeholder="Enter domain or email..."
              className="text-xs bg-subtle border border-line-strong rounded px-2.5 py-1.5 text-fg w-56 font-mono"
            />
            <button
              type="button"
              disabled={loadingEnrichment}
              onClick={() => loadEnrichment(indicatorQuery)}
              className="px-3 py-1.5 bg-accent-solid hover:brightness-110 text-on-solid rounded text-xs font-semibold shadow-xs transition-colors"
            >
              Enrich
            </button>
          </div>
        </div>

        {enrichment ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-subtle border border-line rounded-lg space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-fg">Indicator Metadata</span>
                <span className="text-2xs font-mono bg-accent-solid/10 text-accent px-1.5 py-0.2 rounded font-bold">
                  {enrichment.sourceType.toUpperCase()}
                </span>
              </div>
              <div className="font-mono text-2xs space-y-1 text-fg2">
                <div>Target: <strong className="text-fg">{enrichment.indicator}</strong></div>
                <div>IP Address: {enrichment.ipAddress || 'N/A'}</div>
                <div>ASN: {enrichment.asn || 'N/A'}</div>
                <div>Tor / Hosting Relay: {enrichment.isTorOrHosting ? 'YES (High Risk)' : 'NO'}</div>
                <div>Domain Age: {enrichment.domainAgeDays} days</div>
              </div>
            </div>

            <div className="p-3 bg-subtle border border-line rounded-lg space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-fg">Email &amp; Domain Auth</span>
                <span className="text-2xs font-mono bg-raised text-fg2 px-1.5 py-0.2 rounded">
                  Reputation: {enrichment.reputationScore}/100
                </span>
              </div>
              <div className="font-mono text-2xs space-y-1 text-fg2">
                <div className="flex justify-between">
                  <span>SPF Record:</span>
                  <span className={enrichment.authResults?.spf === 'pass' ? 'text-ok font-bold' : 'text-danger font-bold'}>
                    {enrichment.authResults?.spf?.toUpperCase() || 'NONE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>DKIM Signature:</span>
                  <span className={enrichment.authResults?.dkim === 'pass' ? 'text-ok font-bold' : 'text-danger font-bold'}>
                    {enrichment.authResults?.dkim?.toUpperCase() || 'NONE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>DMARC Policy:</span>
                  <span className={enrichment.authResults?.dmarc === 'pass' ? 'text-ok font-bold' : 'text-danger font-bold'}>
                    {enrichment.authResults?.dmarc?.toUpperCase() || 'NONE'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-subtle border border-line rounded-lg space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-fg">Confidence Assessment</span>
                <span
                  className={`text-2xs font-mono px-2 py-0.5 rounded font-bold ${
                    enrichment.confidence.level === 'HIGH'
                      ? 'bg-danger-solid/10 text-danger'
                      : enrichment.confidence.level === 'MEDIUM'
                      ? 'bg-warn-solid/10 text-warn'
                      : 'bg-ok-solid/10 text-ok'
                  }`}
                >
                  CONFIDENCE: {enrichment.confidence.level}
                </span>
              </div>
              <ul className="text-2xs text-fg2 space-y-1 list-disc pl-4">
                {enrichment.confidence.reasons.map((r: string, idx: number) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
              <div className="text-3xs text-muted italic pt-1">
                Notice: Evaluates payload characteristics only; no individual person verdicts.
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted text-center py-4">No indicator enriched.</div>
        )}
      </div>

      {/* 2. SimHash Cross-App Attack Campaigns */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-2xs">
        <div className="border-b border-line pb-3 mb-4">
          <h3 className="text-sm font-bold text-fg flex items-center gap-2">
            <Radio className="w-4 h-4 text-danger" />
            Coordinated Attack Campaigns (SimHash Clusters)
            <span className="text-2xs font-mono text-muted font-normal">
              [BUILT: 64-Bit Fuzzy Hash Clustering]
            </span>
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Groups semantically similar payloads across applications to track recurring threat actors across time.
          </p>
        </div>

        <div className="space-y-3">
          {campaigns.map((camp) => (
            <div key={camp.id} className="p-4 bg-subtle border border-line rounded-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-fg">{camp.name}</span>
                  <span
                    className={`text-2xs font-mono font-bold px-1.5 py-0.2 rounded ${
                      camp.severity === 'CRITICAL' ? 'bg-danger-solid/10 text-danger' : 'bg-warn-solid/10 text-warn'
                    }`}
                  >
                    {camp.severity}
                  </span>
                  <span className="text-2xs font-mono text-muted">
                    SimHash: {camp.simHashRepresentative}
                  </span>
                </div>
                <div className="text-2xs text-muted font-mono">
                  {camp.incidentCount} Correlated Events · Targeted: {camp.appsTargeted.join(', ')}
                </div>
              </div>

              <p className="text-xs text-fg2 mb-2 font-medium">{camp.targetObjective}</p>

              <div className="bg-surface p-2.5 rounded border border-line text-2xs font-mono text-fg2 space-y-1">
                <div className="text-muted font-semibold uppercase text-3xs">Observed Payload Cluster:</div>
                {camp.payloadClusters.map((p: string, idx: number) => (
                  <div key={idx} className="truncate text-fg">
                    • {p}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Blocklist Manager with STIX Export */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-warn" />
              Dynamic Policy Blocklist &amp; Allowlist Manager
              <span className="text-2xs font-mono text-muted font-normal">
                [BUILT: Human-Approval Required Before Block]
              </span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Maintains active network boundaries, domain restrictions, and appeal workflows with STIX 2.1 interoperability.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportStix}
              className="px-3 py-1.5 bg-subtle hover:bg-raised text-fg2 border border-line-strong rounded text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export STIX 2.1
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 bg-accent-solid hover:brightness-110 text-on-solid rounded text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Indicator
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-subtle border-b border-line text-fg2 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Indicator</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Scope</th>
                <th className="py-2.5 px-3">Mode</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Appeal / Note</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-mono text-2xs">
              {blocklist.map((entry) => (
                <tr key={entry.id} className="hover:bg-subtle/50">
                  <td className="py-2.5 px-3 font-bold text-fg">{entry.indicator}</td>
                  <td className="py-2.5 px-3 uppercase text-fg2">{entry.type}</td>
                  <td className="py-2.5 px-3 capitalize text-fg2">{entry.scope}</td>
                  <td className="py-2.5 px-3 uppercase text-fg2 font-semibold">{entry.mode}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold ${
                        entry.status === 'ACTIVE'
                          ? 'bg-danger-solid/10 text-danger'
                          : entry.status === 'PENDING_APPROVAL'
                          ? 'bg-warn-solid/10 text-warn'
                          : 'bg-ok-solid/10 text-ok'
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-fg2 font-sans max-w-xs truncate">{entry.appealNote || '—'}</td>
                  <td className="py-2.5 px-3 text-right space-x-1.5">
                    {entry.status === 'PENDING_APPROVAL' && (
                      <button
                        type="button"
                        onClick={() => handleApprove(entry.id)}
                        className="px-2 py-0.8 bg-ok-solid text-on-solid rounded font-sans text-2xs font-semibold hover:brightness-110"
                      >
                        Approve Block
                      </button>
                    )}
                    {entry.status !== 'ALLOWLISTED' && (
                      <button
                        type="button"
                        onClick={() => handleAllowlist(entry.id)}
                        className="px-2 py-0.8 bg-raised text-fg rounded font-sans text-2xs font-semibold hover:bg-line-strong"
                      >
                        Allowlist
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Disabled Shared Threat Feed Card (ROADMAP) */}
      <div className="p-5 border border-info-solid/40 bg-info-solid/10 rounded-lg opacity-85">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-info" />
            <h4 className="text-xs font-bold text-info uppercase tracking-wide">
              Shared Cross-Tenant Threat Feed
            </h4>
          </div>
          <span className="text-2xs font-mono font-bold bg-info-solid/10 text-info px-2 py-0.5 rounded">
            [ROADMAP]
          </span>
        </div>
        <p className="text-xs text-info leading-relaxed">
          Decentralized threat intelligence sharing requires verified enterprise tenant identities and cryptographic privacy-preserving differential reporting controls before cross-organization aggregation can be safely enabled.
        </p>
      </div>

      {/* Add Indicator Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div ref={addModalRef} role="dialog" aria-modal="true" aria-label="Add indicator to blocklist" tabIndex={-1} className="bg-surface rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <h4 className="text-sm font-bold text-fg">Add Indicator to Blocklist</h4>
            <form onSubmit={handleCreateBlocklistEntry} className="space-y-3 text-xs">
              <div>
                <label className="block text-fg2 font-semibold mb-1">Indicator (Domain, Email, IP)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. malformed-sink.org"
                  value={newIndicator}
                  onChange={(e) => setNewIndicator(e.target.value)}
                  className="w-full bg-subtle border border-line-strong rounded px-2.5 py-1.5 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-fg2 font-semibold mb-1">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full bg-subtle border border-line-strong rounded px-2 py-1.5"
                  >
                    <option value="domain">Domain</option>
                    <option value="email">Email</option>
                    <option value="upi_handle">UPI Handle</option>
                    <option value="ip">IP Address</option>
                  </select>
                </div>
                <div>
                  <label className="block text-fg2 font-semibold mb-1">Scope</label>
                  <select
                    value={newScope}
                    onChange={(e) => setNewScope(e.target.value)}
                    className="w-full bg-subtle border border-line-strong rounded px-2 py-1.5"
                  >
                    <option value="organization">Organization-Wide</option>
                    <option value="app">App Specific</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-fg2 font-semibold mb-1">Appeal / Security Note</label>
                <textarea
                  rows={2}
                  placeholder="Reason for blocking..."
                  value={newAppealNote}
                  onChange={(e) => setNewAppealNote(e.target.value)}
                  className="w-full bg-subtle border border-line-strong rounded px-2.5 py-1.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-subtle hover:bg-raised text-fg2 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-accent-solid hover:brightness-110 text-on-solid rounded font-semibold"
                >
                  Save (Pending Approval)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
