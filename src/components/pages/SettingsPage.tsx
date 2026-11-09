import React, { useState } from 'react';
import {
  KeyRound,
  Users,
  CreditCard,
  Plus,
  Trash2,
  CheckCircle2,
  Copy,
  Check,
  Shield,
  Layers,
  Info,
} from 'lucide-react';

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsed: string;
  app: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Security Admin' | 'Policy Analyst' | 'Auditor (Read-Only)';
}

export const SettingsPage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'keys' | 'team' | 'billing'>('keys');

  // Seeded mock API Keys
  const [keys, setKeys] = useState<ApiKeyItem[]>([
    {
      id: 'key_01',
      name: 'Production HR Agent Key',
      keyPrefix: 'fw_live_hr_8819_••••••••',
      createdAt: '2026-11-01',
      lastUsed: 'Just now',
      app: 'HR Assistant',
    },
    {
      id: 'key_02',
      name: 'Customer Support Bot Production',
      keyPrefix: 'fw_live_supp_4421_••••••••',
      createdAt: '2026-11-03',
      lastUsed: '4 mins ago',
      app: 'Support Bot',
    },
    {
      id: 'key_03',
      name: 'Search RAG Indexer Key',
      keyPrefix: 'fw_live_search_1092_••••••••',
      createdAt: '2026-11-05',
      lastUsed: '2 hours ago',
      app: 'Internal Search Agent',
    },
  ]);

  // Seeded mock Team Members
  const [team, setTeam] = useState<TeamMember[]>([
    {
      id: 'usr_01',
      name: 'Ananya Deshmukh',
      email: 'ananya.d@acme-cybersec.example.com',
      role: 'Security Admin',
    },
    {
      id: 'usr_02',
      name: 'Vikram Sengupta',
      email: 'vikram.s@acme-cybersec.example.com',
      role: 'Policy Analyst',
    },
    {
      id: 'usr_03',
      name: 'Elena Rostova',
      email: 'elena.r@acme-cybersec.example.com',
      role: 'Auditor (Read-Only)',
    },
  ]);

  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyApp, setNewKeyApp] = useState('HR Assistant');
  const [notice, setNotice] = useState<string | null>(null);

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const newKey: ApiKeyItem = {
      id: `key_${Date.now()}`,
      name: newKeyName.trim(),
      keyPrefix: `fw_live_${Math.random().toString(36).substring(2, 6)}_••••••••`,
      createdAt: new Date().toISOString().split('T')[0],
      lastUsed: 'Never',
      app: newKeyApp,
    };

    setKeys([newKey, ...keys]);
    setNewKeyName('');
    setNotice(`New scoped API key "${newKey.name}" minted.`);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleRevokeKey = (id: string) => {
    setKeys(keys.filter((k) => k.id !== id));
    setNotice('API key revoked.');
    setTimeout(() => setNotice(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tabs */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Organization &amp; Tenant Settings
              <span className="text-2xs font-mono text-cyan-300 bg-cyan-950 border border-cyan-850 px-2 py-0.5 rounded">
                Acme CyberSec Corp
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage gateway credentials, role-based analyst permissions, and subscription tiers.
            </p>
          </div>

          <div className="flex rounded-lg border border-slate-700 p-1 bg-[#0b1329]">
            <button
              type="button"
              onClick={() => setActiveSubTab('keys')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'keys'
                  ? 'bg-cyan-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              API Keys
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('team')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'team'
                  ? 'bg-cyan-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Team &amp; Roles
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('billing')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'billing'
                  ? 'bg-cyan-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Billing
            </button>
          </div>
        </div>

        {notice && (
          <div className="p-3 bg-cyan-950/60 border border-cyan-800 text-cyan-200 rounded-lg text-xs flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Tab 1: API Keys */}
        {activeSubTab === 'keys' && (
          <div className="space-y-5">
            {/* Create Key Form */}
            <form onSubmit={handleCreateKey} className="p-4 bg-[#0b1329] rounded-lg border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Provision New Scoped Agent API Key
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <input
                    type="text"
                    placeholder="Key label (e.g. Staging Candidate Screener)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full bg-[#0f172a] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="sm:col-span-4">
                  <select
                    value={newKeyApp}
                    onChange={(e) => setNewKeyApp(e.target.value)}
                    className="w-full bg-[#0f172a] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="HR Assistant">HR Assistant</option>
                    <option value="Support Bot">Support Bot</option>
                    <option value="Internal Search Agent">Internal Search Agent</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-950" />
                    <span>Create</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Keys Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#0b1329] border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Key Label</th>
                    <th className="py-2.5 px-3">Bound Agent</th>
                    <th className="py-2.5 px-3">Token Prefix</th>
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-3">Last Active</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono">
                  {keys.map((k) => (
                    <tr key={k.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-semibold text-white font-sans">{k.name}</td>
                      <td className="py-2.5 px-3 text-cyan-400">{k.app}</td>
                      <td className="py-2.5 px-3 text-slate-300">{k.keyPrefix}</td>
                      <td className="py-2.5 px-3 text-slate-400">{k.createdAt}</td>
                      <td className="py-2.5 px-3 text-slate-400">{k.lastUsed}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRevokeKey(k.id)}
                          className="text-2xs text-rose-400 hover:text-rose-300 font-sans"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Team & Roles */}
        {activeSubTab === 'team' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold text-white">Active Team Members &amp; Permissions</span>
              <span className="text-2xs font-mono text-slate-400">3 Members Configured</span>
            </div>

            <div className="divide-y divide-slate-800/80">
              {team.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="font-semibold text-white">{m.name}</div>
                    <div className="text-2xs font-mono text-slate-400">{m.email}</div>
                  </div>
                  <div>
                    <span
                      className={`text-2xs font-mono font-bold px-2.5 py-0.5 rounded border ${
                        m.role === 'Security Admin'
                          ? 'bg-rose-950 text-rose-300 border-rose-800'
                          : m.role === 'Policy Analyst'
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {m.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Billing & Tiers */}
        {activeSubTab === 'billing' && (
          <div className="space-y-5">
            <div className="p-3 bg-[#0b1329] border border-slate-800 rounded-lg text-xs text-slate-300 flex items-center justify-between">
              <div>
                <span className="text-white font-semibold">Current Subscription: </span>
                <span className="text-cyan-400 font-mono font-bold">Team Tier (3 Protected Agents)</span>
              </div>
              <span className="font-mono text-2xs text-slate-400">Next billing cycle: Dec 1, 2026</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Free Tier */}
              <div className="p-4 rounded-xl bg-[#0b1329] border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase">Developer</span>
                <div className="text-2xl font-bold font-mono text-white">$0 <span className="text-xs font-normal text-slate-500">/mo</span></div>
                <p className="text-2xs text-slate-400">For testing and personal AI agents.</p>
                <div className="text-2xs space-y-1.5 text-slate-300 border-t border-slate-800 pt-3 font-mono">
                  <div>✓ 1 Protected Agent</div>
                  <div>✓ Basic Heuristic Detectors</div>
                  <div>✓ 1,000 monthly calls</div>
                  <div>✗ Scoped Credential Broker</div>
                </div>
                <div className="pt-2 text-center text-2xs font-mono text-slate-500">
                  Illustrative pricing
                </div>
              </div>

              {/* Team Tier (Active) */}
              <div className="p-4 rounded-xl bg-[#0d1c3a] border-2 border-cyan-500 shadow-md space-y-3 relative">
                <span className="absolute -top-2.5 right-4 bg-cyan-500 text-slate-950 font-bold font-mono text-2xs px-2 py-0.5 rounded">
                  CURRENT PLAN
                </span>
                <span className="text-xs font-bold text-cyan-300 uppercase">Team Per-App</span>
                <div className="text-2xl font-bold font-mono text-white">$149 <span className="text-xs font-normal text-slate-400">/app/mo</span></div>
                <p className="text-2xs text-slate-300">For production multi-agent pipelines.</p>
                <div className="text-2xs space-y-1.5 text-slate-200 border-t border-cyan-800/60 pt-3 font-mono">
                  <div>✓ Up to 10 Protected Agents</div>
                  <div>✓ Action Gate + Scoped Tokens</div>
                  <div>✓ Verhoeff &amp; Luhn PII Redaction</div>
                  <div>✓ 60-Second Approval Queue</div>
                  <div>✓ Keyed Audit Hash Chain</div>
                </div>
                <div className="pt-2 text-center text-2xs font-mono text-cyan-400 font-semibold">
                  Illustrative pricing
                </div>
              </div>

              {/* Enterprise Tier */}
              <div className="p-4 rounded-xl bg-[#0b1329] border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase">Enterprise</span>
                <div className="text-2xl font-bold font-mono text-white">$999 <span className="text-xs font-normal text-slate-500">/mo custom</span></div>
                <p className="text-2xs text-slate-400">Dedicated boundary and regulatory audit.</p>
                <div className="text-2xs space-y-1.5 text-slate-300 border-t border-slate-800 pt-3 font-mono">
                  <div>✓ Unlimited Protected Agents</div>
                  <div>✓ Custom YAML Rule Engine</div>
                  <div>✓ External Transparency Anchor [ROADMAP]</div>
                  <div>✓ Dedicated VPC Tool Proxy</div>
                  <div>✓ SLA 99.99% Guaranteed</div>
                </div>
                <div className="pt-2 text-center text-2xs font-mono text-slate-500">
                  Illustrative pricing
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
