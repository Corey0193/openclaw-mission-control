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

      <main className="[grid-area:main] p-6 space-y-6 overflow-y-auto bg-[#f8f9fa]">
        {/* Zone 1 — Summary bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Experiments"
            value={`${stats.completed} completed`}
            subValue={`${stats.pending} pending`}
            icon={<IconFlask size={20} />}
          />
          <SummaryCard
            label="Best Test"
            value={`Sharpe ${stats.bestSharpe.toFixed(2)}`}
            subValue={stats.bestExpId}
            icon={<IconTrophy size={20} />}
          />
          <SummaryCard
            label="Milestones"
            value={`${stats.milestones} found`}
            subValue="(Sharpe > 0, trades > 20)"
            icon={<IconTarget size={20} />}
          />
          <SummaryCard
            label="Compute Loop"
            value={systemState?.status === "active" ? "Running ✓" : "Idle"}
            subValue={systemState?.completedAt ? `Last: ${timeAgo(systemState.completedAt)}` : "Never"}
            icon={<IconCpu size={20} />}
          />
        </div>

        {/* Zone 2 — List + Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px] h-[calc(100vh-280px)]">
          {/* Left Panel — Scrollable List */}
          <div className="lg:col-span-4 xl:col-span-3 bg-white border border-border rounded-xl flex flex-col overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Experiment History</h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white border border-border rounded-md px-1.5 py-0.5">
                  <IconFilter size={12} className="text-muted-foreground mr-1" />
                  <select 
                    value={filter} 
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="text-[10px] font-bold uppercase bg-transparent border-none focus:ring-0 p-0 cursor-pointer"
                  >
                    <option value="all">All</option>
                    <option value="milestone">Milestones</option>
                    <option value="success">Profitable</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div className="flex items-center bg-white border border-border rounded-md px-1.5 py-0.5">
                  <IconArrowsSort size={12} className="text-muted-foreground mr-1" />
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-[10px] font-bold uppercase bg-transparent border-none focus:ring-0 p-0 cursor-pointer"
                  >
                    <option value="latest">Latest</option>
                    <option value="sharpe">Best Sharpe</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredExperiments.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No experiments found
                </div>
              ) : (
                filteredExperiments.map((exp) => (
                  <button
                    key={exp.experimentId}
                    onClick={() => setSelectedId(exp.experimentId)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/50 transition-colors text-left ${
                      (selectedId === exp.experimentId || (!selectedId && exp === filteredExperiments[0])) ? "bg-muted/50 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {exp.status === "milestone" ? (
                        <IconStarFilled size={16} className="text-yellow-500" />
                      ) : exp.status === "pending" ? (
                        <IconCircleFilled size={12} className="text-amber-400" />
                      ) : exp.status === "error" ? (
                        <IconAlertCircle size={16} className="text-red-500" />
                      ) : (
                        <IconCircleFilled size={12} className={(exp.bestTrial?.test?.sharpe || 0) > 0 ? "text-emerald-500" : "text-slate-300"} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground truncate">{exp.experimentId}</span>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">{exp.status}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {exp.bestTrial?.test ? (
                            <>
                              Test: <span className={(exp.bestTrial.test.sharpe || 0) > 0 ? "text-emerald-600 font-bold" : "text-foreground"}>
                                {exp.bestTrial.test.sharpe.toFixed(2)}
                              </span>
                              {" · "}{exp.bestTrial.test.trades} trades
                            </>
                          ) : exp.status === "pending" ? (
                            <span className="italic">queued...</span>
                          ) : (
                            "—"
                          )}
                        </span>
                        <span className="text-[9px] text-muted-foreground bg-muted/50 px-1 py-0.5 rounded">
                          {formatDateTime(exp.completedAt || (exp as any).lastSyncedAt)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Panel — Detail */}
          <div className="lg:col-span-8 xl:col-span-9 bg-white border border-border rounded-xl flex flex-col overflow-hidden shadow-sm">
            {selectedExperiment ? (
              <div className="p-8 h-full overflow-y-auto space-y-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">{selectedExperiment.experimentId}</h2>
                    <p className="text-base text-muted-foreground mt-1 max-w-2xl">{selectedExperiment.hypothesis}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      selectedExperiment.status === 'milestone' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                      selectedExperiment.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                      'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {selectedExperiment.status}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      Ran {formatDateTime(selectedExperiment.completedAt)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                  <div className="xl:col-span-4 space-y-6">
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                        <IconCpu size={14} /> Frozen Parameters
                      </h4>
                      <div className="bg-muted/30 rounded-lg p-4 space-y-2.5 border border-border/50">
                        {selectedExperiment.frozenParams ? (
                          Object.entries(selectedExperiment.frozenParams).map(([key, val]) => (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="text-muted-foreground font-mono text-[11px]">{key}</span>
                              <span className="font-semibold text-foreground">{String(val)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground italic">No frozen params</div>
                        )}
                      </div>
                    </div>

                    {selectedExperiment.bestTrial?.test?.exit_reasons && (
                      <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Exit Distribution (Test)</h4>
                        <div className="space-y-3 bg-muted/20 p-4 rounded-lg border border-border/50">
                          {Object.entries(selectedExperiment.bestTrial.test.exit_reasons).map(([reason, count]: [string, any]) => {
                            const total = Object.values(selectedExperiment.bestTrial.test.exit_reasons).reduce((a: any, b: any) => a + b, 0) as number;
                            const pct = (count / total) * 100;
                            return (
                              <div key={reason} className="space-y-1.5">
                                <div className="flex justify-between text-[11px]">
                                  <span className="font-bold text-foreground">{reason}</span>
                                  <span className="text-muted-foreground font-mono">{count} ({pct.toFixed(0)}%)</span>
                                </div>
                                <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-border/50">
                                  <div className="h-full bg-slate-400" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="xl:col-span-8 space-y-6">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                      <IconChartBar size={14} /> Performance Matrix (Walk-Forward)
                    </h4>
                    <div className="overflow-hidden border border-border rounded-xl">
                      <div className="grid grid-cols-4 text-center gap-0 bg-muted/50 border-b border-border py-3">
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Metric</div>
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Train (60%)</div>
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Val (20%)</div>
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Test (20%)</div>
                      </div>
                      {[
                        { label: "P&L", key: "pnl", prefix: "$" },
                        { label: "Sharpe", key: "sharpe" },
                        { label: "Trades", key: "trades" },
                        { label: "Win Rate", key: "win_rate", suffix: "%" },
                        { label: "Max DD", key: "max_dd", suffix: "%" },
                      ].map((row, idx) => (
                        <div key={row.key} className={`grid grid-cols-4 text-center gap-0 items-center py-4 ${idx !== 4 ? 'border-b border-border/50' : ''}`}>
                          <div className="text-xs font-bold text-muted-foreground uppercase text-left pl-6">{row.label}</div>
                          {["train", "validate", "test"].map((phase) => {
                            const val = selectedExperiment.bestTrial?.[phase]?.[row.key];
                            const displayVal = val !== undefined 
                              ? (row.key === "win_rate" || row.key === "max_dd" ? (val * 100).toFixed(1) : val.toFixed(2))
                              : "—";
                            
                            let color = "text-foreground";
                            if (row.key === "sharpe" && val !== undefined) color = val > 0.5 ? "text-emerald-600 font-bold text-sm" : val > 0 ? "text-emerald-500 font-medium" : val < 0 ? "text-red-500" : "text-foreground";
                            if (row.key === "pnl" && val !== undefined) color = val > 0 ? "text-emerald-600" : val < 0 ? "text-red-500" : "text-foreground";

                            return (
                              <div key={phase} className={`text-sm font-semibold ${color}`}>
                                {val !== undefined ? `${row.prefix || ""}${displayVal}${row.suffix || ""}` : "—"}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>

                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4">
                      <div className="flex gap-3">
                        <IconFlask className="text-blue-500 flex-shrink-0" size={18} />
                        <div className="text-xs text-blue-800 leading-relaxed">
                          <strong>Backtest Insight:</strong> This experiment used {selectedExperiment.summary?.total_trials || 100} Optuna trials. 
                          The "Test" window represents a final exam on unseen data. 
                          {selectedExperiment.bestTrial?.test?.sharpe > selectedExperiment.bestTrial?.train?.sharpe 
                            ? " Surprisingly, the strategy performed better on the test set than the training set, suggesting high robustness." 
                            : selectedExperiment.bestTrial?.test?.sharpe > 0 
                              ? " The strategy maintained profitability out-of-sample, which is a strong validation signal."
                              : " The negative performance in the test window suggests the strategy overfitted to the training data."}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-border mt-auto flex justify-between items-center">
                  <div className="flex gap-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Trials Summary</span>
                      <span className="text-sm font-semibold">{selectedExperiment.summary?.total_trials || 100} total · {selectedExperiment.summary?.completed_trials || 0} complete · {selectedExperiment.summary?.pruned_trials || 0} pruned</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Compute Duration</span>
                      <span className="text-sm font-semibold">{selectedExperiment.durationSeconds ? `${Math.floor(selectedExperiment.durationSeconds / 60)}m ${selectedExperiment.durationSeconds % 60}s` : "Unknown"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center bg-muted/5">
                <IconFlask size={64} strokeWidth={1} className="mb-4 opacity-10" />
                <h3 className="text-xl font-medium text-foreground/50">No Experiment Selected</h3>
                <p className="text-base max-w-sm">Select an experiment from the history on the left to analyze its performance data.</p>
              </div>
            )}
          </div>
        </div>

        {/* Zone 3 — Trend charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
          {/* Sharpe Progression */}
          <div className="bg-white border border-border rounded-xl p-6 h-[300px] flex flex-col">
            <h3 className="text-sm font-semibold text-foreground mb-4">Sharpe Progression</h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Line type="monotone" dataKey="train" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="validate" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="test" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
               <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#94a3b8]" /><span className="text-[10px] font-bold text-muted-foreground uppercase">Train</span></div>
               <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#6366f1]" /><span className="text-[10px] font-bold text-muted-foreground uppercase">Val</span></div>
               <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#10b981]" /><span className="text-[10px] font-bold text-muted-foreground uppercase">Test</span></div>
            </div>
          </div>

          {/* Trade Count */}
          <div className="bg-white border border-border rounded-xl p-6 h-[300px] flex flex-col">
            <h3 className="text-sm font-semibold text-foreground mb-4">Trade Count by Experiment</h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Bar dataKey="trades" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.trades < 20 ? "#fbbf24" : "#6366f1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
