"use client";

import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import OrgChartPage from "./pages/OrgChartPage";
import EinsteinTodosPage from "./pages/EinsteinTodosPage";
import PolymarketPage from "./pages/PolymarketPage";
import TokenUsagePage from "./pages/TokenUsagePage";
import ArbPipelinePage from "./pages/ArbPipelinePage";
import WalletsPage from "./pages/WalletsPage";
import ArbExperimentsPage from "./pages/ArbExperimentsPage";

const SoftArbPage = lazy(() => import("./pages/SoftArbPage"));
const HardArbPage = lazy(() => import("./pages/HardArbPage"));
const CopyTradePage = lazy(() => import("./pages/CopyTradePage"));
const CopyTradeV2Page = lazy(() => import("./pages/CopyTradeV2Page"));

export default function App() {
	return (
		<Routes>
			<Route path="/" element={<DashboardPage />} />
			<Route path="/org" element={<OrgChartPage />} />
			<Route path="/todos" element={<EinsteinTodosPage />} />
			<Route path="/token-usage" element={<TokenUsagePage />} />

			{/* Arbitrage routes */}
			<Route path="/arb" element={<Navigate to="/arb/hard" replace />} />
			<Route
				path="/polymarket"
				element={<Navigate to="/arb/polymarket" replace />}
			/>

			<Route path="/arb/polymarket" element={<PolymarketPage />} />
			<Route path="/arb/experiments" element={<ArbExperimentsPage />} />
			<Route
			        path="/arb/backtesting"
			        element={<Navigate to="/arb/experiments" replace />}
			/>
			<Route path="/arb/pipeline" element={<ArbPipelinePage />} />			<Route path="/arb/wallets" element={<WalletsPage />} />

			<Route
				path="/arb/soft"
				element={
					<Suspense fallback={<div className="min-h-screen bg-[#f8f9fa]" />}>
						<SoftArbPage />
					</Suspense>
				}
			/>
			<Route
				path="/arb/hard"
				element={
					<Suspense fallback={<div className="min-h-screen bg-[#f8f9fa]" />}>
						<HardArbPage />
					</Suspense>
				}
			/>
			<Route
				path="/copy-trade"
				element={
					<Suspense fallback={<div className="min-h-screen bg-[#f8f9fa]" />}>
						<CopyTradePage />
					</Suspense>
				}
			/>
			<Route
				path="/copy-trade-v2"
				element={
					<Suspense fallback={<div className="min-h-screen bg-[#f8f9fa]" />}>
						<CopyTradeV2Page />
					</Suspense>
				}
			/>
		</Routes>
	);
}
