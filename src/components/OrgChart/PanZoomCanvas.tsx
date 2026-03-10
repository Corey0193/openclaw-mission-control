import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";

interface PanZoomCanvasProps {
	children: ReactNode;
	minZoom?: number;
	maxZoom?: number;
	zoomStep?: number;
}

export default function PanZoomCanvas({
	children,
	minZoom = 0.3,
	maxZoom = 1.5,
	zoomStep = 0.1,
}: PanZoomCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);
	const [isPointerDown, setIsPointerDown] = useState(false);
	const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
	const DRAG_THRESHOLD = 4;

	// Measure the union bounding rect of all visible descendants (handles absolute positioning)
	const measureFullBounds = useCallback((root: HTMLElement) => {
		const elements = root.querySelectorAll("button, .org-connector-stem, .org-connector-drop, .org-connector-row");
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const el of elements) {
			const r = el.getBoundingClientRect();
			if (r.width === 0 && r.height === 0) continue;
			minX = Math.min(minX, r.left);
			minY = Math.min(minY, r.top);
			maxX = Math.max(maxX, r.right);
			maxY = Math.max(maxY, r.bottom);
		}
		return { width: maxX - minX, height: maxY - minY, left: minX, top: minY };
	}, []);

	// Fit content to container on mount and resize
	const fitToView = useCallback(() => {
		const container = containerRef.current;
		const content = contentRef.current;
		if (!container || !content) return;

		// Temporarily reset transform to measure natural size
		content.style.transform = "none";
		const bounds = measureFullBounds(content);
		const containerRect = container.getBoundingClientRect();
		content.style.transform = "";

		if (!isFinite(bounds.width) || !isFinite(bounds.height)) return;

		const scaleX = containerRect.width / bounds.width;
		const scaleY = containerRect.height / bounds.height;
		const fitScale = Math.min(scaleX, scaleY, 1) * 0.9; // 90% to add some padding
		const clampedScale = Math.max(minZoom, Math.min(maxZoom, fitScale));

		// Pan so the union bounds center aligns with container center.
		// Bounds are in viewport coords while transform is "none" (content at inset-0).
		// Content origin = container origin when transform is none.
		// After scaling by clampedScale around center center, we need to shift so the
		// scaled content's visual center matches the container center.
		const contentOriginX = containerRect.left + containerRect.width / 2;
		const contentOriginY = containerRect.top + containerRect.height / 2;
		const boundsCenterX = bounds.left + bounds.width / 2;
		const boundsCenterY = bounds.top + bounds.height / 2;
		// How far the bounds center is from the transform origin (before scaling)
		const offsetX = boundsCenterX - contentOriginX;
		const offsetY = boundsCenterY - contentOriginY;
		// After scaling, that offset becomes offset * scale, so pan to compensate
		const panX = -offsetX * clampedScale;
		const panY = -offsetY * clampedScale;

		// Apply transform directly to avoid race with ResizeObserver re-triggering
		content.style.transform = `translate(${panX}px, ${panY}px) scale(${clampedScale})`;
		setZoom(clampedScale);
		setPan({ x: panX, y: panY });
	}, [minZoom, maxZoom, measureFullBounds]);

	useEffect(() => {
		// Small delay to let the tree render
		const timer = setTimeout(fitToView, 100);
		return () => clearTimeout(timer);
	}, [fitToView]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const observer = new ResizeObserver(() => fitToView());
		observer.observe(container);
		return () => observer.disconnect();
	}, [fitToView]);

	// Wheel zoom
	const handleWheel = useCallback(
		(e: React.WheelEvent) => {
			e.preventDefault();
			const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
			setZoom((z) => Math.max(minZoom, Math.min(maxZoom, z + delta)));
		},
		[minZoom, maxZoom, zoomStep],
	);

	// Mouse drag (with threshold to avoid stealing clicks from nodes)
	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (e.button !== 0) return;
			setIsPointerDown(true);
			dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
		},
		[pan],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!isPointerDown) return;
			const dx = e.clientX - dragStart.current.x;
			const dy = e.clientY - dragStart.current.y;
			if (!isDragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
			if (!isDragging) setIsDragging(true);
			setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
		},
		[isPointerDown, isDragging],
	);

	const handleMouseUp = useCallback(() => {
		setIsPointerDown(false);
		setIsDragging(false);
	}, []);

	// Touch drag + pinch zoom
	const lastTouches = useRef<{ x: number; y: number; dist?: number } | null>(null);

	const handleTouchStart = useCallback(
		(e: React.TouchEvent) => {
			if (e.touches.length === 1) {
				const t = e.touches[0];
				lastTouches.current = { x: t.clientX, y: t.clientY };
				dragStart.current = { x: t.clientX, y: t.clientY, panX: pan.x, panY: pan.y };
			} else if (e.touches.length === 2) {
				const dx = e.touches[0].clientX - e.touches[1].clientX;
				const dy = e.touches[0].clientY - e.touches[1].clientY;
				lastTouches.current = {
					x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
					y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
					dist: Math.hypot(dx, dy),
				};
			}
		},
		[pan],
	);

	const handleTouchMove = useCallback(
		(e: React.TouchEvent) => {
			e.preventDefault();
			if (e.touches.length === 1 && lastTouches.current) {
				const t = e.touches[0];
				const dx = t.clientX - dragStart.current.x;
				const dy = t.clientY - dragStart.current.y;
				setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
			} else if (e.touches.length === 2 && lastTouches.current?.dist) {
				const dx = e.touches[0].clientX - e.touches[1].clientX;
				const dy = e.touches[0].clientY - e.touches[1].clientY;
				const newDist = Math.hypot(dx, dy);
				const scale = newDist / lastTouches.current.dist;
				setZoom((z) => Math.max(minZoom, Math.min(maxZoom, z * scale)));
				lastTouches.current.dist = newDist;
			}
		},
		[minZoom, maxZoom],
	);

	const handleTouchEnd = useCallback(() => {
		lastTouches.current = null;
	}, []);

	const zoomIn = () => setZoom((z) => Math.min(maxZoom, z + zoomStep));
	const zoomOut = () => setZoom((z) => Math.max(minZoom, z - zoomStep));
	const zoomPercent = Math.round(zoom * 100);

	return (
		<div
			ref={containerRef}
			className="relative flex-1 overflow-hidden"
			style={{ cursor: isDragging ? "grabbing" : "default" }}
			onWheel={handleWheel}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
		>
			<div
				ref={contentRef}
				className="absolute inset-0 flex items-center justify-center"
				style={{
					transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
					transformOrigin: "center center",
					pointerEvents: isDragging ? "none" : "auto",
				}}
			>
				{children}
			</div>

			{/* Zoom controls */}
			<div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/90 dark:bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-sm px-1 py-1 z-10">
				<button
					type="button"
					onClick={zoomOut}
					className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-foreground/70 hover:text-foreground transition-colors text-lg font-medium"
					title="Zoom out"
				>
					-
				</button>
				<span className="text-[11px] font-medium text-muted-foreground w-10 text-center tabular-nums">
					{zoomPercent}%
				</span>
				<button
					type="button"
					onClick={zoomIn}
					className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-foreground/70 hover:text-foreground transition-colors text-lg font-medium"
					title="Zoom in"
				>
					+
				</button>
				<div className="w-px h-5 bg-border mx-0.5" />
				<button
					type="button"
					onClick={fitToView}
					className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-foreground/70 hover:text-foreground transition-colors"
					title="Fit to view"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
					</svg>
				</button>
			</div>
		</div>
	);
}
