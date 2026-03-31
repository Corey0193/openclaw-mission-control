import React, { useState } from "react";
import { IconSettings, IconChartBar, IconPlayerPlay, IconDatabase, IconCheck, IconX } from "@tabler/icons-react";

export default function BacktestingPage() {
    const [isOptimizing, setIsOptimizing] = useState(false);
    
    // Mocking latest best_params.json and study data based on the backtester output structure
    const latestResults = {
        trialNumber: 52,
        value: 1.4500,
        metrics: {
            train_pnl: 1452.30,
            trade_count: 85,
            win_rate: 0.65,
            max_dd: 0.15
        },
        windows: {
            train: { pnl: 1452.30, sharpe: 1.45, maxDd: 0.15, trades: 85, winRate: 0.65 },
            validate: { pnl: 340.10, sharpe: 1.10, maxDd: 0.22, trades: 25, winRate: 0.58 },
            test: { pnl: 410.50, sharpe: 1.25, maxDd: 0.18, trades: 30, winRate: 0.61 }
        },
        params: {
            cts_threshold: 80,
            latency_seconds: 15.5,
            position_pct: 0.05,
            max_position_usd: 50.0,
            max_concurrent_positions: 10,
            max_leaders: 15,
            exit_strategy: "TRAILING",
            execution_mode: "TAKER",
            trailing_stop_pct: 0.12,
            slippage_multiplier: 1.5,
        }
    };

    const handleRunOptimization = () => {
        setIsOptimizing(true);
        setTimeout(() => setIsOptimizing(false), 3000);
    };

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
                            <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Optimizing...</>
                        ) : (
                            <><IconPlayerPlay size={18} /> Run Optimizer</>
                        )}
                    </button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Top Metrics & Best Trial Params */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                                    <IconDatabase size={16} className="text-slate-500" />
                                    Latest Best Trial (#{latestResults.trialNumber})
                                </h2>
                            </div>
                            <div className="p-4 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-slate-500 font-medium">Train P&L</p>
                                    <p className="text-lg font-bold text-emerald-600">+${latestResults.metrics.train_pnl.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-medium">Win Rate</p>
                                    <p className="text-lg font-bold text-slate-800">{(latestResults.metrics.win_rate * 100).toFixed(1)}%</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-medium">Max Drawdown</p>
                                    <p className="text-lg font-bold text-rose-600">{(latestResults.metrics.max_dd * 100).toFixed(1)}%</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-medium">Trades</p>
                                    <p className="text-lg font-bold text-slate-800">{latestResults.metrics.trade_count}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Hyperparameters</h2>
                            </div>
                            <div className="p-4">
                                <ul className="space-y-3">
                                    {Object.entries(latestResults.params).map(([key, val]) => (
                                        <li key={key} className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500 font-mono text-xs">{key}</span>
                                            <span className="font-semibold text-slate-800">{val}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Walk-Forward Validation & Equity Simulation */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                                    <IconChartBar size={16} className="text-slate-500" />
                                    Walk-Forward Validation
                                </h2>
                            </div>
                            <div className="p-4 overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-xs tracking-wider">
                                            <th className="pb-3 pr-4">Metric</th>
                                            <th className="pb-3 px-4">Train (60%)</th>
                                            <th className="pb-3 px-4">Validate (20%)</th>
                                            <th className="pb-3 pl-4">Test (20%)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr>
                                            <td className="py-3 pr-4 font-medium text-slate-700">P&L</td>
                                            <td className="py-3 px-4 font-bold text-emerald-600">+${latestResults.windows.train.pnl.toFixed(2)}</td>
                                            <td className="py-3 px-4 font-bold text-emerald-600">+${latestResults.windows.validate.pnl.toFixed(2)}</td>
                                            <td className="py-3 pl-4 font-bold text-emerald-600">+${latestResults.windows.test.pnl.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-3 pr-4 font-medium text-slate-700">Sharpe Ratio</td>
                                            <td className="py-3 px-4 text-slate-800">{latestResults.windows.train.sharpe.toFixed(3)}</td>
                                            <td className="py-3 px-4 text-slate-800">{latestResults.windows.validate.sharpe.toFixed(3)}</td>
                                            <td className="py-3 pl-4 text-slate-800">{latestResults.windows.test.sharpe.toFixed(3)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-3 pr-4 font-medium text-slate-700">Max DD</td>
                                            <td className="py-3 px-4 text-rose-600">{(latestResults.windows.train.maxDd * 100).toFixed(1)}%</td>
                                            <td className="py-3 px-4 text-rose-600">{(latestResults.windows.validate.maxDd * 100).toFixed(1)}%</td>
                                            <td className="py-3 pl-4 text-rose-600">{(latestResults.windows.test.maxDd * 100).toFixed(1)}%</td>
                                        </tr>
                                        <tr>
                                            <td className="py-3 pr-4 font-medium text-slate-700">Trades</td>
                                            <td className="py-3 px-4 text-slate-800">{latestResults.windows.train.trades}</td>
                                            <td className="py-3 px-4 text-slate-800">{latestResults.windows.validate.trades}</td>
                                            <td className="py-3 pl-4 text-slate-800">{latestResults.windows.test.trades}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-3 pr-4 font-medium text-slate-700">Win Rate</td>
                                            <td className="py-3 px-4 text-slate-800">{(latestResults.windows.train.winRate * 100).toFixed(1)}%</td>
                                            <td className="py-3 px-4 text-slate-800">{(latestResults.windows.validate.winRate * 100).toFixed(1)}%</td>
                                            <td className="py-3 pl-4 text-slate-800">{(latestResults.windows.test.winRate * 100).toFixed(1)}%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        {/* Placeholder for Equity Curve Chart */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-64">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Equity Curve</h2>
                                <span className="text-xs text-slate-500">Train / Val / Test Composite</span>
                            </div>
                            <div className="flex-1 flex items-center justify-center bg-slate-50 relative">
                                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNjY2MiLz4KPC9zdmc+')] opacity-50" />
                                <div className="z-10 text-center space-y-2">
                                    <IconChartBar className="mx-auto text-slate-300 w-12 h-12" />
                                    <p className="text-sm text-slate-500 font-medium">Chart Visualization Placeholder</p>
                                    <p className="text-xs text-slate-400">Run optimization to refresh equity data.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
