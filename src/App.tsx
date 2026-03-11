"use client";

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import OrgChartPage from "./pages/OrgChartPage";
import EinsteinTodosPage from "./pages/EinsteinTodosPage";
import PolymarketPage from "./pages/PolymarketPage";

const ArbPaperPage = lazy(() => import("./pages/ArbPaperPage"));

export default function App() {
	return (
		<Routes>
			<Route path="/" element={<DashboardPage />} />
			<Route path="/org" element={<OrgChartPage />} />
			<Route path="/todos" element={<EinsteinTodosPage />} />
			<Route path="/polymarket" element={<PolymarketPage />} />
			<Route path="/arb" element={<Suspense fallback={<div className="min-h-screen bg-[#f8f9fa]" />}><ArbPaperPage /></Suspense>} />
		</Routes>
	);
}
