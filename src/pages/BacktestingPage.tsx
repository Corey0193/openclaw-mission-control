import { useState, useEffect, useCallback, useMemo } from "react";
import { IconSettings, IconChartBar, IconPlayerPlay, IconDatabase, IconAlertCircle, IconLoader2 } from "@tabler/icons-react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface BacktestResults {
    bestParams: any;
    equity: {
        train: any[];
        val: any[];
        test: any[];
    };
}

export default function BacktestingPage() {
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [results, setResults] = useState<BacktestResults | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const getResults = useAction(api.backtesting.getResultsAction);
    const runOptimizerAction = useAction(api.backtesting.runOptimizer);

    const fetchData = useCallback(async () => {
        try {
            const data = await getResults({ tenantId: DEFAULT_TENANT_ID });
            setResults(data as any);
            setError(null);
        } catch (err: any) {
            console.error("Failed to fetch backtest results:", err);
            setError("Failed to load backtest results. Make sure the backend is accessible.");
        } finally {
            setIsLoading(false);
        }
    }, [getResults]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRunOptimization = async () => {
        setIsOptimizing(true);
        setError(null);
        try {
            const res = await runOptimizerAction({ tenantId: DEFAULT_TENANT_ID });
            if (res.success) {
                await fetchData();
            } else {
                setError(`Optimization failed: ${res.error || "Unknown error"}`);
            }
        } catch (err: any) {
            setError(`Failed to trigger optimizer: ${err.message}`);
        } finally {
            setIsOptimizing(false);
        }
    };

    const chartData = useMemo(() => {
        if (!results) return [];
        
        // Combine train, val, test into one sequence for the chart
        // We'll use the 'index' as the X axis
        const data: any[] = [];
        let globalIndex = 0;
        
        results.equity.train.forEach((pt: any) => {
            data.push({
                index: globalIndex++,
                train: pt.equity_usd || pt.equity,
                val: null,
                test: null
            });
        });
        
        results.equity.val.forEach((pt: any) => {
            data.push({
                index: globalIndex++,
                train: null,
                val: pt.equity_usd || pt.equity,
                test: null
            });
        });
        
        results.equity.test.forEach((pt: any) => {
            data.push({
                index: globalIndex++,
                train: null,
                val: null,
                test: pt.equity_usd || pt.equity
            });
        });
        
        return data;
    }, [results]);

    if (isLoading) {
        return (
            <main className="[grid-area:main] flex items-center justify-center bg-slate-50 min-h-screen">
                <div className="text-center space-y-4">
                    <IconLoader2 className="animate-spin text-[var(--accent-orange)] mx-auto" size={48} />
                    <p className="text-slate-500 font-medium">Loading Backtesting Dashboard...</p>
                </div>
            </main>
        );
    }

    const hasResults = results && results.bestParams;
    const params = hasResults ? results.bestParams : null;
    const displayParams = params || {};
    
    return (
        <main className="[grid-area:main] overflow-y-auto bg-slate-50 min-h-screen">
            <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <IconSettings className="text-[var(--accent-orange)]" />
                            Polymarket Backtesting & Optimizer
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Analyze strategy performance, hyperparameter tuning, and walk-forward validation.
                        </p>
                    </div>
                    <button 
                        onClick={handleRunOptimization}
                        disabled={isOptimizing}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white shadow-sm transition-all
                            ${isOptimizing ? "bg-slate-400 cursor-not-allowed" : "bg-[var(--accent-orange)] hover:bg-orange-600 hover:shadow-md"}`}
                    >
                        {isOptimizing ? (
                            <><IconLoader2 className="animate-spin h-4 w-4" /> Optimizing...</>
                        ) : (
                            <><IconPlayerPlay size={18} /> Run Optimizer</>
                        )}
                    </button>
                </header>

                {error && (
                    <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3 text-rose-800 text-sm">
                        <IconAlertCircle className="shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="font-bold">Error</p>
                            <p className="font-mono text-[10px] whitespace-pre-wrap">{error}</p>
                        </div>
                    </div>
                )}

                {!hasResults && !error ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center space-y-4">
                        <IconDatabase className="mx-auto text-slate-300" size={48} />
                        <div className="max-w-md mx-auto">
                            <h2 className="text-lg font-bold text-slate-800">No Results Found</h2>
                            <p className="text-slate-500 text-sm mt-1">
                                No backtesting results were found on the server. Click "Run Optimizer" to generate the first set of results.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                                        <IconDatabase size={16} className="text-slate-500" />
                                        Best Parameters
                                    </h2>
                                </div>
                                <div className="p-4 max-h-[600px] overflow-y-auto">
                                    <ul className="space-y-3">
                                        {Object.entries(displayParams).filter(([k]) => typeof k === 'string' && k !== 'seed').map(([key, val]) => (
                                            <li key={key} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                                <span className="text-slate-500 font-mono text-xs">{key}</span>
                                                <span className="font-semibold text-slate-800">{String(val)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                                        <IconChartBar size={16} className="text-slate-500" />
                                        Equity Curve (Walk-Forward)
                                    </h2>
                                </div>
                                <div className="p-4 h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="index" hide />
                                            <YAxis 
                                                domain={['auto', 'auto']}
                                                tick={{fontSize: 10, fill: '#64748b'}}
                                                tickFormatter={(v) => `$${v}`}
                                            />
                                            <Tooltip 
                                                labelStyle={{ display: 'none' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="top" height={36}/>
                                            <Line 
                                                type="monotone" 
                                                dataKey="train" 
                                                stroke="#10b981" 
                                                strokeWidth={2} 
                                                dot={false} 
                                                name="Train"
                                                connectNulls
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="val" 
                                                stroke="#f59e0b" 
                                                strokeWidth={2} 
                                                dot={false} 
                                                name="Validate"
                                                connectNulls
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="test" 
                                                stroke="#3b82f6" 
                                                strokeWidth={2} 
                                                dot={false} 
                                                name="Test"
                                                connectNulls
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Train Points</p>
                                    <p className="text-xl font-black text-emerald-600">{results?.equity.train.length || 0}</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Val Points</p>
                                    <p className="text-xl font-black text-amber-500">{results?.equity.val.length || 0}</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Test Points</p>
                                    <p className="text-xl font-black text-blue-500">{results?.equity.test.length || 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
