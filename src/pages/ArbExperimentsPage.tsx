import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import Header from "../components/Header";
import {
  IconChartBar,
  IconClock,
  IconCpu,
  IconFlask,
  IconTarget,
  IconTrophy,
  IconCircleFilled,
  IconStarFilled,
  IconAlertCircle,
  IconTrendingUp,
  IconTrendingDown,
  IconFilter,
  IconArrowsSort,
  IconCalendar,
} from "@tabler/icons-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

// Reuse SummaryCard from PolymarketPage
function SummaryCard({
  label,
  value,
  subValue,
  icon,
  status,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  status?: "success" | "warning" | "error" | "default";
}) {
  return (
    <div className="flex items-center gap-3 bg-white border border-border rounded-xl px-5 py-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
          {label}
        </div>
        <div className="text-lg font-bold text-foreground">
          {value}
        </div>
        {subValue && (
          <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "never";
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleString([], { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

export default function ArbExperimentsPage() {
  const experiments = useQuery(api.experiments.list, { tenantId: DEFAULT_TENANT_ID }) || [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "milestone" | "success" | "pending">("all");
  const [sortBy, setSortBy] = useState<"latest" | "sharpe">("latest");

  // Filter out system state entries
  const realExperiments = experiments.filter(e => e.experimentId !== "system_compute_loop");
  const systemState = experiments.find(e => e.experimentId === "system_compute_loop");

  const filteredExperiments = useMemo(() => {
    let result = [...realExperiments];
    
    if (filter === "milestone") {
      result = result.filter(e => e.status === "milestone");
    } else if (filter === "success") {
      result = result.filter(e => (e.bestTrial?.test?.sharpe || 0) > 0);
    } else if (filter === "pending") {
      result = result.filter(e => e.status === "pending");
    }

    return result.sort((a, b) => {
      if (sortBy === "sharpe") {
        const aSharpe = a.bestTrial?.test?.sharpe || -999;
        const bSharpe = b.bestTrial?.test?.sharpe || -999;
        return bSharpe - aSharpe;
      } else {
        const aTime = a.completedAt || "";
        const bTime = b.completedAt || "";
        return bTime.localeCompare(aTime);
      }
    });
  }, [realExperiments, filter, sortBy]);

  const selectedExperiment = useMemo(() => {
    return filteredExperiments.find(e => e.experimentId === selectedId) || filteredExperiments[0];
  }, [filteredExperiments, selectedId]);

  // Zone 1 Summary Data
  const stats = useMemo(() => {
    const completed = realExperiments.filter(e => e.status === "completed" || e.status === "milestone").length;
    const pending = realExperiments.filter(e => e.status === "pending").length;
    const milestones = realExperiments.filter(e => e.status === "milestone").length;
    
    let bestSharpe = 0;
    let bestExpId = "none";
    realExperiments.forEach(e => {
      const sharpe = e.bestTrial?.test?.sharpe || 0;
      if (sharpe > bestSharpe) {
        bestSharpe = sharpe;
        bestExpId = e.experimentId;
      }
    });

    return { completed, pending, milestones, bestSharpe, bestExpId };
  }, [realExperiments]);

  // Zone 3 Chart Data
  const chartData = useMemo(() => {
    return [...realExperiments]
      .filter(e => e.completedAt)
      .sort((a, b) => (a.completedAt || "").localeCompare(b.completedAt || ""))
      .map(e => ({
        name: e.experimentId.replace("seed_", ""),
        train: e.bestTrial?.train?.sharpe || 0,
        validate: e.bestTrial?.validate?.sharpe || 0,
        test: e.bestTrial?.test?.sharpe || 0,
        trades: e.bestTrial?.test?.trades || 0,
      }));
  }, [realExperiments]);

  return (
    <div className="app-container">
      <Header title="Experiments & Analysis" />

      <main className="[grid-area:main] p-8 space-y-8 overflow-y-auto bg-[#f8f9fa]">
        {/* Zone 1 — Summary bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <SummaryCard
            label="Experiments"
            value={`${stats.completed} completed`}
            subValue={`${stats.pending} pending`}
            icon={<IconFlask size={24} />}
          />
          <SummaryCard
            label="Best Test"
            value={`Sharpe ${stats.bestSharpe.toFixed(2)}`}
            subValue={stats.bestExpId}
            icon={<IconTrophy size={24} />}
          />
          <SummaryCard
            label="Milestones"
            value={`${stats.milestones} found`}
            subValue="(Sharpe > 0, trades > 20)"
            icon={<IconTarget size={24} />}
          />
          <SummaryCard
            label="Compute Loop"
            value={systemState?.status === "active" ? "Running ✓" : "Idle"}
            subValue={systemState?.completedAt ? `Last: ${timeAgo(systemState.completedAt)}` : "Never"}
            icon={<IconCpu size={24} />}
          />
        </div>

        {/* Zone 2 — List + Detail */}
        <div className="flex flex-col xl:flex-row gap-8 items-start relative">
          
          {/* Left Panel — Scrollable List (Sticky) */}
          <div 
            className="w-full xl:w-[400px] flex-shrink-0 bg-white border border-border rounded-2xl flex flex-col shadow-sm sticky top-0"
            style={{ maxHeight: "calc(100vh - 160px)" }}
          >
            <div className="px-5 py-4 border-b border-border bg-slate-50/80 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-base font-semibold text-foreground">History</h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white border border-border rounded-md px-2 py-1 shadow-sm hover:border-slate-300 transition-colors">
                  <IconFilter size={14} className="text-muted-foreground mr-1.5" />
                  <select 
                    value={filter} 
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="text-xs font-semibold uppercase text-slate-600 bg-transparent border-none focus:ring-0 p-0 cursor-pointer outline-none"
                  >
                    <option value="all">All</option>
                    <option value="milestone">Milestones</option>
                    <option value="success">Profitable</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div className="flex items-center bg-white border border-border rounded-md px-2 py-1 shadow-sm hover:border-slate-300 transition-colors">
                  <IconArrowsSort size={14} className="text-muted-foreground mr-1.5" />
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-xs font-semibold uppercase text-slate-600 bg-transparent border-none focus:ring-0 p-0 cursor-pointer outline-none"
                  >
                    <option value="latest">Latest</option>
                    <option value="sharpe">Best Sharpe</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {filteredExperiments.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground text-sm">
                  No experiments found matching filters
                </div>
              ) : (
                filteredExperiments.map((exp) => (
                  <button
                    key={exp.experimentId}
                    onClick={() => setSelectedId(exp.experimentId)}
                    className={`w-full flex flex-col gap-2 px-5 py-4 border-b border-border/80 last:border-0 hover:bg-slate-50 transition-colors text-left ${
                      (selectedId === exp.experimentId || (!selectedId && exp === filteredExperiments[0])) 
                        ? "bg-slate-50/50 border-l-4 border-l-primary" 
                        : "border-l-4 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {exp.status === "milestone" ? (
                          <IconStarFilled size={18} className="text-yellow-500 flex-shrink-0" />
                        ) : exp.status === "pending" ? (
                          <IconCircleFilled size={12} className="text-amber-400 flex-shrink-0" />
                        ) : exp.status === "error" ? (
                          <IconAlertCircle size={18} className="text-red-500 flex-shrink-0" />
                        ) : (
                          <IconCircleFilled size={12} className={(exp.bestTrial?.test?.sharpe || 0) > 0 ? "text-emerald-500 flex-shrink-0" : "text-slate-300 flex-shrink-0"} />
                        )}
                        <span className="text-sm font-bold text-foreground truncate">{exp.experimentId}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-slate-100/50 px-2 py-1 rounded">
                        {exp.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between w-full pl-[26px]">
                      <span className="text-xs text-slate-500 font-medium">
                        {exp.bestTrial?.test ? (
                          <>
                            Test Sharpe: <span className={(exp.bestTrial.test.sharpe || 0) > 0 ? "text-emerald-600 font-bold" : "text-foreground font-semibold"}>
                              {exp.bestTrial.test.sharpe.toFixed(2)}
                            </span>
                            <span className="text-slate-300 mx-1.5">|</span>
                            {exp.bestTrial.test.trades} trades
                          </>
                        ) : exp.status === "pending" ? (
                          <span className="italic">queued for compute...</span>
                        ) : (
                          "—"
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                        {timeAgo(exp.completedAt || (exp as any).lastSyncedAt)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Panel — Detail */}
          <div className="flex-1 min-w-0 bg-white border border-border rounded-2xl flex flex-col shadow-sm min-h-[500px]">
            {selectedExperiment ? (
              <div className="p-8 lg:p-10 flex flex-col h-full gap-8">
                
                {/* Header */}
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-start gap-6">
                    <div>
                      <h2 className="text-3xl font-extrabold text-foreground tracking-tight">{selectedExperiment.experimentId}</h2>
                      <p className="text-base text-slate-500 mt-2 max-w-3xl leading-relaxed">{selectedExperiment.hypothesis}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2.5 flex-shrink-0">
                      <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest ${
                        selectedExperiment.status === 'milestone' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200 shadow-sm' :
                        selectedExperiment.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm' :
                        'bg-slate-100 text-slate-700 border border-slate-200 shadow-sm'
                      }`}>
                        {selectedExperiment.status}
                      </span>
                      <span className="text-sm text-slate-500 font-medium bg-slate-50 px-3 py-1 rounded-md border border-slate-100 shadow-sm">
                        {formatDateTime(selectedExperiment.completedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub Header Metrics */}
                <div className="flex flex-wrap gap-4 border-b border-border pb-8">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 flex-1 min-w-[200px] shadow-sm">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Trials Summary</div>
                    <div className="text-lg font-bold text-slate-800">
                      {selectedExperiment.summary?.total_trials || 100} <span className="text-sm font-medium text-slate-500">total</span> 
                      <span className="text-slate-300 mx-2">·</span> 
                      {selectedExperiment.summary?.completed_trials || 0} <span className="text-sm font-medium text-slate-500">complete</span>
                      <span className="text-slate-300 mx-2">·</span> 
                      {selectedExperiment.summary?.pruned_trials || 0} <span className="text-sm font-medium text-slate-500">pruned</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 flex-1 min-w-[200px] shadow-sm">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <IconClock size={14} /> Compute Duration
                    </div>
                    <div className="text-lg font-bold text-slate-800">
                      {selectedExperiment.durationSeconds 
                        ? `${Math.floor(selectedExperiment.durationSeconds / 60)}m ${selectedExperiment.durationSeconds % 60}s` 
                        : "Unknown"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 2xl:grid-cols-12 gap-10">
                  {/* Performance Panel */}
                  <div className="2xl:col-span-8 flex flex-col gap-8">
                    
                    <div className="flex flex-col gap-4">
                      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <IconChartBar size={18} className="text-indigo-500" /> Performance Matrix (Walk-Forward)
                      </h4>
                      <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-6 py-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider">Metric</th>
                              <th className="px-6 py-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider text-center border-l border-slate-200">Train (60%)</th>
                              <th className="px-6 py-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider text-center border-l border-slate-200">Val (20%)</th>
                              <th className="px-6 py-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider text-center border-l border-slate-200">Test (20%)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {[
                              { label: "P&L", key: "pnl", prefix: "$" },
                              { label: "Sharpe", key: "sharpe" },
                              { label: "Trades", key: "trades" },
                              { label: "Win Rate", key: "win_rate", suffix: "%" },
                              { label: "Max DD", key: "max_dd", suffix: "%" },
                            ].map((row) => (
                              <tr key={row.key} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 text-sm font-bold text-slate-600 bg-slate-50/30">
                                  {row.label}
                                </td>
                                {["train", "validate", "test"].map((phase) => {
                                  const val = selectedExperiment.bestTrial?.[phase]?.[row.key];
                                  const displayVal = val !== undefined 
                                    ? (row.key === "win_rate" || row.key === "max_dd" ? (val * 100).toFixed(1) : parseFloat(val.toFixed(2)).toLocaleString())
                                    : "—";
                                  
                                  let color = "text-slate-800";
                                  let weight = "font-semibold";
                                  
                                  if (row.key === "sharpe" && val !== undefined) {
                                    if (val > 0.5) { color = "text-emerald-600"; weight = "font-extrabold text-base"; }
                                    else if (val > 0) { color = "text-emerald-500"; weight = "font-bold"; }
                                    else if (val < 0) { color = "text-red-500"; weight = "font-medium"; }
                                  }
                                  if (row.key === "pnl" && val !== undefined) {
                                    if (val > 0) { color = "text-emerald-600"; weight = "font-bold text-base"; }
                                    else if (val < 0) { color = "text-red-500"; weight = "font-medium"; }
                                  }

                                  return (
                                    <td key={phase} className={`px-6 py-4 text-sm text-center border-l border-slate-100 ${color} ${weight}`}>
                                      {val !== undefined ? `${row.prefix || ""}${displayVal}${row.suffix || ""}` : "—"}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-5 shadow-sm">
                      <div className="flex gap-4">
                        <div className="bg-white p-2 rounded-full h-fit border border-blue-100 shadow-sm flex-shrink-0">
                          <IconFlask className="text-blue-600" size={20} />
                        </div>
                        <div className="text-sm text-blue-900 leading-relaxed pt-1">
                          <strong className="font-bold mr-1">Backtest Insight:</strong> 
                          This experiment ran {selectedExperiment.summary?.total_trials || 100} Optuna trials. 
                          The Test outcome reflects true out-of-sample performance. 
                          {selectedExperiment.bestTrial?.test?.sharpe > selectedExperiment.bestTrial?.train?.sharpe 
                            ? " The strategy scored higher on the test set than training, which is rare and signals high robustness." 
                            : selectedExperiment.bestTrial?.test?.sharpe > 0 
                              ? " The strategy stayed profitable out-of-sample, building confidence for live trading."
                              : " Negative test performance indicates curve-fitting to the training dataset. Refine logic or limits."}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Panel */}
                  <div className="2xl:col-span-4 flex flex-col gap-8">
                    
                    {/* Frozen Parameters */}
                    <div className="flex flex-col gap-4">
                      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <IconCpu size={18} className="text-slate-400" /> Frozen Parameters
                      </h4>
                      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-sm">
                        {selectedExperiment.frozenParams && Object.keys(selectedExperiment.frozenParams).length > 0 ? (
                          <div className="space-y-3.5">
                            {Object.entries(selectedExperiment.frozenParams).map(([key, val]) => (
                               <div key={key} className="flex justify-between items-center gap-4 border-b border-slate-200/60 pb-3 last:border-0 last:pb-0">
                                <span className="text-slate-500 font-mono text-[11px] truncate max-w-[140px]" title={key}>{key}</span>
                                <span className="font-bold text-slate-800 text-sm whitespace-pre-wrap">{String(val)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400 italic py-4 text-center">No frozen parameters provided</div>
                        )}
                      </div>
                    </div>

                    {/* Exit Distribution */}
                    {selectedExperiment.bestTrial?.test?.exit_reasons && (
                      <div className="flex flex-col gap-4">
                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Exit Distribution (Test)</h4>
                        <div className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm">
                          {Object.entries(selectedExperiment.bestTrial.test.exit_reasons).map(([reason, count]: [string, any]) => {
                            const total = Object.values(selectedExperiment.bestTrial.test.exit_reasons).reduce((a: any, b: any) => a + b, 0) as number;
                            const pct = total > 0 ? (count / total) * 100 : 0;
                            return (
                              <div key={reason} className="flex flex-col gap-2">
                                <div className="flex justify-between items-end text-sm">
                                  <span className="font-bold text-slate-700">{reason}</span>
                                  <span className="text-slate-500 font-mono text-xs bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                                    {count} <span className="text-slate-400">({pct.toFixed(0)}%)</span>
                                  </span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                                  <div 
                                    className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                                    style={{ width: `${pct}%` }} 
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-16 text-center bg-slate-50/50 rounded-2xl">
                <IconFlask size={80} strokeWidth={1} className="mb-6 opacity-20 text-slate-500" />
                <h3 className="text-2xl font-bold text-slate-700 mb-2">No Experiment Selected</h3>
                <p className="text-base text-slate-500 max-w-md leading-relaxed">
                  Select a completed or pending experiment from the history sidebar to view its walk-forward performance bounds and parameter constraints.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Zone 3 — Trend charts */}
        <div className="mt-8 pt-8 border-t border-slate-200 grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Sharpe Progression */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 h-[400px] flex flex-col shadow-sm">
            <h3 className="text-base font-bold text-slate-800 mb-1">Global Sharpe Progression</h3>
            <p className="text-sm text-slate-500 mb-6 font-medium">Tracking strategy durability across validation barriers over time</p>
            <div className="flex-1 min-h-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 25, left: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    fontSize={11} 
                    tickMargin={12} 
                    axisLine={false} 
                    tickLine={false} 
                    stroke="#64748b" 
                    angle={-45} 
                    textAnchor="end"
                  />
                  <YAxis fontSize={12} axisLine={false} tickLine={false} stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    itemStyle={{ fontSize: '13px', fontWeight: 600 }}
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '4 4' }}
                  />
                  <Line name="Train Set" type="monotone" dataKey="train" stroke="#94a3b8" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  <Line name="Validation Set" type="monotone" dataKey="validate" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  <Line name="Test Set" type="monotone" dataKey="test" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 0 }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-6">
               <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
                 <div className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]" />
                 <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">Train (60%)</span>
               </div>
               <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                 <div className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" />
                 <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-widest">Val (20%)</span>
               </div>
               <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                 <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                 <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest">Test (20%)</span>
               </div>
            </div>
          </div>

          {/* Trade Count */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 h-[400px] flex flex-col shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1">Execution Volume by Experiment</h3>
                <p className="text-sm text-slate-500 font-medium">Tracking number of test-set trades to ensure statistical significance</p>
              </div>
            </div>
            <div className="flex-1 min-h-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 25, left: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    fontSize={11} 
                    tickMargin={12} 
                    axisLine={false} 
                    tickLine={false} 
                    stroke="#64748b"
                    angle={-45} 
                    textAnchor="end"
                  />
                  <YAxis fontSize={12} axisLine={false} tickLine={false} stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    itemStyle={{ fontSize: '13px', fontWeight: 600 }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar name="Trades" dataKey="trades" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.trades < 20 ? "#fbbf24" : "#818cf8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-6">
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full border border-amber-100">
                <div className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-widest">Low Volume</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                <div className="w-2.5 h-2.5 rounded-full bg-[#818cf8]" />
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-widest">Valid Volume</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
