import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertCircle, Info, ExternalLink, CheckCircle2, Clock, Check } from 'lucide-react';
import { ComplianceMatrixResponse, fetchComplianceMatrix } from '../../services/api.ts';

export const CompliancePage: React.FC = () => {
  const [data, setData] = useState<ComplianceMatrixResponse | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    fetchComplianceMatrix()
      .then((res) => setData(res))
      .catch((err) => console.error('Failed to load compliance matrix:', err));
  }, []);

  const items = (data?.matrix || []).filter((item) => {
    if (filterStatus === 'ALL') return true;
    return item.status.toUpperCase() === filterStatus.toUpperCase();
  });

  return (
    <div className="space-y-6">
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              OWASP Top 10 for LLM Applications Compliance Matrix
              <span className="text-2xs font-mono text-cyan-300 bg-cyan-950 border border-cyan-850 px-2 py-0.5 rounded">
                [Honest Evaluation]
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Architectural alignment against the OWASP Top 10 for Large Language Model Applications (2025/2026).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filter Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#0b1329] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Items (10)</option>
              <option value="Covered">Covered (5)</option>
              <option value="Partial">Partial (3)</option>
              <option value="Roadmap">Roadmap (2)</option>
            </select>
          </div>
        </div>

        {/* Disclaimer Notice */}
        <div className="p-3.5 bg-amber-950/40 border border-amber-800/60 text-amber-200 rounded-lg text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <strong className="text-white">Honesty Notice: </strong>
            {data?.disclaimer || 'Notice: This mapping represents architectural coverage within the prototype test scope. Mapping is not formal certification.'}
            <span className="text-amber-300 ml-1">
              Never claim 100% protection against adaptive adversarial attacks. The Action Gate acts as a deterministic boundary for tool calls routed through the gate and verified by the tool server.
            </span>
          </div>
        </div>

        {/* Stats summary strip */}
        <div className="grid grid-cols-3 gap-3 font-mono text-xs">
          <div className="p-3 rounded-lg bg-[#0b1329] border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Covered in Gateway</span>
            <span className="text-emerald-400 font-bold">5 Items (50%)</span>
          </div>
          <div className="p-3 rounded-lg bg-[#0b1329] border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Partial Mitigation</span>
            <span className="text-amber-400 font-bold">3 Items (30%)</span>
          </div>
          <div className="p-3 rounded-lg bg-[#0b1329] border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Planned Roadmap</span>
            <span className="text-purple-400 font-bold">2 Items (20%)</span>
          </div>
        </div>
      </div>

      {/* Compliance Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#0b1329] border-b border-slate-800 text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4 w-28">OWASP ID</th>
                <th className="py-3 px-4 w-52">Vulnerability Title</th>
                <th className="py-3 px-4 w-32">Gateway Status</th>
                <th className="py-3 px-4">LLM Firewall Mechanisms</th>
                <th className="py-3 px-4">Engineering Scope Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">{item.id}</td>
                  <td className="py-3.5 px-4 font-semibold text-white">{item.name}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`text-2xs font-mono font-bold px-2.5 py-0.5 rounded border uppercase ${
                        item.status === 'Covered'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : item.status === 'Partial'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-purple-950 text-purple-300 border-purple-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1.5">
                      {item.mechanisms.map((mech, idx) => (
                        <span
                          key={idx}
                          className="text-2xs font-mono bg-[#0b1329] border border-slate-700/80 text-slate-200 px-2 py-0.5 rounded"
                        >
                          {mech}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-2xs text-slate-400 leading-relaxed">
                    {item.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
