import { useRef, useState } from "react";

interface AnomalyMarker {
  time_sec: number;
  label: string;
  severity: "high" | "medium" | "low";
}

interface SpectrogramHeatmapProps {
  spectrogramB64: string;
  anomalyMarkers: AnomalyMarker[];
  duration: number;
  className?: string;
}

export function SpectrogramHeatmap({
  spectrogramB64,
  anomalyMarkers,
  duration,
  className = "",
}: SpectrogramHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredMarker, setHoveredMarker] = useState<AnomalyMarker | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const relX = x / rect.width;
    const time = relX * duration;
    setHoverTime(time);
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    // Find nearest anomaly marker
    const nearest = anomalyMarkers.find(m => Math.abs(m.time_sec - time) < duration * 0.03);
    setHoveredMarker(nearest || null);
  };

  const severityColor = (s: string) =>
    s === "high" ? "hsl(0, 84%, 60%)" : s === "medium" ? "hsl(43, 96%, 56%)" : "hsl(155, 100%, 50%)";

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toFixed(2).padStart(5, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className={`relative rounded-lg overflow-hidden cursor-crosshair ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        setHoveredMarker(null);
        setHoverTime(null);
      }}
    >
      {/* Spectrogram image */}
      <img
        src={`data:image/png;base64,${spectrogramB64}`}
        alt="Forensic Spectrogram"
        className="w-full rounded-lg"
        style={{ imageRendering: "auto" }}
      />

      {/* Anomaly marker overlays */}
      {anomalyMarkers.map((m, i) => (
        <div
          key={i}
          className="absolute top-0 h-full"
          style={{
            left: `${(m.time_sec / duration) * 100}%`,
            width: "2px",
            background: `${severityColor(m.severity)}80`,
            boxShadow: `0 0 8px ${severityColor(m.severity)}60`,
          }}
        >
          {/* Marker dot */}
          <div
            className="absolute -top-1 -left-1.5 w-4 h-4 rounded-full border-2"
            style={{
              borderColor: severityColor(m.severity),
              background: `${severityColor(m.severity)}30`,
            }}
          />
        </div>
      ))}

      {/* Hover crosshair */}
      {hoverTime !== null && (
        <div
          className="absolute top-0 h-full w-px pointer-events-none"
          style={{
            left: `${(hoverTime / duration) * 100}%`,
            background: "hsla(189, 100%, 50%, 0.5)",
            boxShadow: "0 0 8px hsla(189, 100%, 50%, 0.3)",
          }}
        />
      )}

      {/* Tooltip */}
      {hoveredMarker && (
        <div
          className="absolute z-20 pointer-events-none glass-panel px-3 py-2 rounded-lg"
          style={{
            left: Math.min(tooltipPos.x + 10, (containerRef.current?.offsetWidth || 300) - 200),
            top: Math.max(tooltipPos.y - 60, 5),
            minWidth: 180,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: severityColor(hoveredMarker.severity) }}
            />
            <span
              className="font-mono text-[10px] font-bold uppercase"
              style={{ color: severityColor(hoveredMarker.severity) }}
            >
              {hoveredMarker.severity}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatTime(hoveredMarker.time_sec)}
            </span>
          </div>
          <p className="font-mono text-xs text-foreground leading-tight">
            {hoveredMarker.label}
          </p>
        </div>
      )}

      {/* Time cursor display */}
      {hoverTime !== null && !hoveredMarker && (
        <div
          className="absolute z-20 pointer-events-none glass-panel px-2 py-1 rounded"
          style={{
            left: Math.min(tooltipPos.x + 10, (containerRef.current?.offsetWidth || 300) - 100),
            top: tooltipPos.y - 30,
          }}
        >
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatTime(hoverTime)}
          </span>
        </div>
      )}
    </div>
  );
}
