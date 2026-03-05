"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { Routes, Route } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import OrgChartPage from "./pages/OrgChartPage";
import EinsteinTodosPage from "./pages/EinsteinTodosPage";
import PolymarketPage from "./pages/PolymarketPage";
import SignInForm from "./components/SignIn";

export default function App() {
	return (
		<>
			<Authenticated>
				<Routes>
					<Route path="/" element={<DashboardPage />} />
					<Route path="/org" element={<OrgChartPage />} />
				<Route path="/todos" element={<EinsteinTodosPage />} />
					<Route path="/polymarket" element={<PolymarketPage />} />
				</Routes>
			</Authenticated>
			<Unauthenticated>
				<SignInForm />
			</Unauthenticated>
		</>
	);
}
