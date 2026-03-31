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

export default function ArbExperimentsPage() {
  const experiments = useQuery(api.experiments.list, { tenantId: DEFAULT_TENANT_ID }) || [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter out system state entries
  const realExperiments = experiments.filter(e => e.experimentId !== "system_compute_loop");
  const systemState = experiments.find(e => e.experimentId === "system_compute_loop");

  const sortedExperiments = useMemo(() => {
    return [...realExperiments].sort((a, b) => {
      const aTime = a.completedAt || "";
      const bTime = b.completedAt || "";
      return bTime.localeCompare(aTime);
    });
  }, [realExperiments]);

  const selectedExperiment = useMemo(() => {
    return sortedExperiments.find(e => e.experimentId === selectedId) || sortedExperiments[0];
  }, [sortedExperiments, selectedId]);

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
    <div className="flex flex-col min-h-screen bg-[#f8f9fa]">
      <Header title="Experiments & Analysis" />

      <main className="flex-1 p-6 space-y-6 overflow-y-auto">
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
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 h-[500px]">
          {/* Left Panel — Scrollable List */}
          <div className="lg:col-span-4 bg-white border border-border rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">Experiment History</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sortedExperiments.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No experiments found
                </div>
              ) : (
                sortedExperiments.map((exp) => (
                  <button
                    key={exp.experimentId}
                    onClick={() => setSelectedId(exp.experimentId)}
                    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors text-left ${
                      (selectedId === exp.experimentId || (!selectedId && exp === sortedExperiments[0])) ? "bg-muted/50" : ""
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
                        <IconCircleFilled size={12} className={exp.bestTrial?.test?.sharpe > 0 ? "text-emerald-500" : "text-slate-300"} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground truncate">{exp.experimentId}</span>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground ml-2">{exp.status}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {exp.bestTrial?.test ? (
                            <>
                              Test: {exp.bestTrial.test.sharpe.toFixed(2)}{" "}
                              {exp.bestTrial.test.sharpe > 0 ? (
                                <IconTrendingUp size={10} className="inline text-emerald-500 mb-0.5" />
                              ) : (
                                <IconTrendingDown size={10} className="inline text-red-500 mb-0.5" />
                              )}
                              {" · "}{exp.bestTrial.test.trades} trades
                            </>
                          ) : exp.status === "pending" ? (
                            "queued..."
                          ) : (
                            "—"
                          )}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {exp.durationSeconds ? `${Math.floor(exp.durationSeconds / 60)}m ${exp.durationSeconds % 60}s` : ""}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Panel — Detail */}
          <div className="lg:col-span-6 bg-white border border-border rounded-xl flex flex-col overflow-hidden">
            {selectedExperiment ? (
              <div className="p-6 h-full overflow-y-auto space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{selectedExperiment.experimentId}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{selectedExperiment.hypothesis}</p>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Frozen Params</h4>
                    <div className="space-y-1.5">
                      {selectedExperiment.frozenParams ? (
                        Object.entries(selectedExperiment.frozenParams).map(([key, val]) => (
                          <div key={key} className="flex justify-between text-xs">
                            <span className="text-muted-foreground font-mono">{key}</span>
                            <span className="font-semibold">{String(val)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-muted-foreground italic">No frozen params</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-4 text-center gap-1 border-b border-border pb-1">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase"></div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase">Train</div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase">Val</div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase">Test</div>
                    </div>
                    {[
                      { label: "P&L", key: "pnl", prefix: "$" },
                      { label: "Sharpe", key: "sharpe" },
                      { label: "Trades", key: "trades" },
                      { label: "Win Rate", key: "win_rate", suffix: "%" },
                      { label: "Max DD", key: "max_dd", suffix: "%" },
                    ].map((row) => (
                      <div key={row.key} className="grid grid-cols-4 text-center gap-1 items-center">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase text-left">{row.label}</div>
                        {["train", "validate", "test"].map((phase) => {
                          const val = selectedExperiment.bestTrial?.[phase]?.[row.key];
                          const displayVal = val !== undefined 
                            ? (row.key === "win_rate" || row.key === "max_dd" ? (val * 100).toFixed(1) : val.toFixed(2))
                            : "—";
                          
                          let color = "text-foreground";
                          if (row.key === "sharpe" && val !== undefined) color = val > 0.3 ? "text-emerald-600 font-bold" : val < 0 ? "text-red-500" : "text-foreground";
                          if (row.key === "pnl" && val !== undefined) color = val > 0 ? "text-emerald-600" : val < 0 ? "text-red-500" : "text-foreground";

                          return (
                            <div key={phase} className={`text-xs font-medium ${color}`}>
                              {val !== undefined ? `${row.prefix || ""}${displayVal}${row.suffix || ""}` : "—"}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedExperiment.bestTrial?.test?.exit_reasons && (
                  <div>
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Exit Reasons (Test)</h4>
                    <div className="space-y-2">
                      {Object.entries(selectedExperiment.bestTrial.test.exit_reasons).map(([reason, count]: [string, any]) => {
                        const total = Object.values(selectedExperiment.bestTrial.test.exit_reasons).reduce((a: any, b: any) => a + b, 0) as number;
                        const pct = (count / total) * 100;
                        return (
                          <div key={reason} className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="font-semibold text-foreground">{reason}</span>
                              <span className="text-muted-foreground">{count}</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-slate-400" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-border mt-auto">
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                    <span>Trials: {selectedExperiment.summary?.total_trials || 100} total · {selectedExperiment.summary?.completed_trials || 0} complete · {selectedExperiment.summary?.pruned_trials || 0} pruned</span>
                    <span>{selectedExperiment.durationSeconds ? `${Math.floor(selectedExperiment.durationSeconds / 60)}m ${selectedExperiment.durationSeconds % 60}s` : ""}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                <IconFlask size={48} strokeWidth={1} className="mb-4 opacity-20" />
                <h3 className="text-lg font-medium">No Experiment Selected</h3>
                <p className="text-sm">Select an experiment from the list to view its performance details.</p>
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
