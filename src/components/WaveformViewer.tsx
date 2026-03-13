import { useEffect, useRef, useState } from "react";

interface AnomalyMarker {
  time_sec: number;
  label: string;
  severity: "high" | "medium" | "low";
}

interface WaveformViewerProps {
  waveformEnvelope: number[];
  anomalyMarkers: AnomalyMarker[];
  duration: number;
  spectrogramB64?: string | null;
}

export function WaveformViewer({
  waveformEnvelope,
  anomalyMarkers,
  duration,
}: WaveformViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredMarker, setHoveredMarker] = useState<AnomalyMarker | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [mouseX, setMouseX] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const mid = h / 2;

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "hsl(225, 25%, 6%)");
    bgGrad.addColorStop(1, "hsl(225, 30%, 4%)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "hsla(210, 30%, 30%, 0.08)";
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Anomaly regions
    anomalyMarkers.forEach((a) => {
      const x = (a.time_sec / duration) * w;
      const regionW = w * 0.04;
      const gradient = ctx.createLinearGradient(x - regionW / 2, 0, x + regionW / 2, 0);
      if (a.severity === "high") {
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(0.5, "rgba(239, 68, 68, 0.12)");
        gradient.addColorStop(1, "transparent");
      } else if (a.severity === "medium") {
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(0.5, "rgba(251, 191, 36, 0.1)");
        gradient.addColorStop(1, "transparent");
      } else {
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(0.5, "rgba(0, 255, 136, 0.06)");
        gradient.addColorStop(1, "transparent");
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(x - regionW / 2, 0, regionW, h);
    });

    // Real waveform
    if (waveformEnvelope && waveformEnvelope.length > 0) {
      const maxAmp = Math.max(...waveformEnvelope, 0.001);

      // Waveform fill (gradient)
      ctx.beginPath();
      ctx.moveTo(0, mid);
      waveformEnvelope.forEach((amp, i) => {
        const x = (i / (waveformEnvelope.length - 1)) * w;
        const y = mid - (amp / maxAmp) * mid * 0.85;
        ctx.lineTo(x, y);
      });
      ctx.lineTo(w, mid);
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, 0, w, 0);
      fillGrad.addColorStop(0, "hsla(189, 100%, 50%, 0.08)");
      fillGrad.addColorStop(0.3, "hsla(270, 100%, 65%, 0.06)");
      fillGrad.addColorStop(0.6, "hsla(189, 100%, 50%, 0.08)");
      fillGrad.addColorStop(1, "hsla(155, 100%, 50%, 0.06)");
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Upper waveform line
      ctx.beginPath();
      const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
      lineGrad.addColorStop(0, "hsl(189, 100%, 50%)");
      lineGrad.addColorStop(0.5, "hsl(270, 100%, 65%)");
      lineGrad.addColorStop(1, "hsl(155, 100%, 50%)");
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 1.5;
      waveformEnvelope.forEach((amp, i) => {
        const x = (i / (waveformEnvelope.length - 1)) * w;
        const y = mid - (amp / maxAmp) * mid * 0.85;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Mirror (lower)
      ctx.beginPath();
      ctx.strokeStyle = lineGrad;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      waveformEnvelope.forEach((amp, i) => {
        const x = (i / (waveformEnvelope.length - 1)) * w;
        const y = mid + (amp / maxAmp) * mid * 0.85;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Anomaly marker lines + labels
    anomalyMarkers.forEach((a) => {
      const x = (a.time_sec / duration) * w;
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle =
        a.severity === "high"
          ? "#ef4444"
          : a.severity === "medium"
            ? "#fbbf24"
            : "#00ff88";
      ctx.lineWidth = 1.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Marker dot
      ctx.beginPath();
      ctx.arc(x, 10, 4, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();

      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle =
        a.severity === "high"
          ? "#ef4444"
          : a.severity === "medium"
            ? "#fbbf24"
            : "#00ff88";
      ctx.fillText(a.label, x + 8, 14);
    });

    // Cursor glow line
    if (mouseX !== null) {
      const glowGrad = ctx.createLinearGradient(mouseX, 0, mouseX, h);
      glowGrad.addColorStop(0, "hsla(189, 100%, 50%, 0)");
      glowGrad.addColorStop(0.5, "hsla(189, 100%, 50%, 0.4)");
      glowGrad.addColorStop(1, "hsla(189, 100%, 50%, 0)");
      ctx.beginPath();
      ctx.moveTo(mouseX, 0);
      ctx.lineTo(mouseX, h);
      ctx.strokeStyle = glowGrad;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Center line
    ctx.beginPath();
    ctx.strokeStyle = "hsla(210, 30%, 30%, 0.15)";
    ctx.lineWidth = 1;
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();
  }, [waveformEnvelope, anomalyMarkers, duration, mouseX]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const relX = x / rect.width;
    const time = relX * duration;
    setMouseX(x);

    const nearest = anomalyMarkers.find(m => Math.abs(m.time_sec - time) < duration * 0.03);
    setHoveredMarker(nearest || null);
    setTooltipPos({ x, y: e.clientY - rect.top });
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="forensic-card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          Waveform Analysis
        </h3>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />{" "}
            High
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />{" "}
            Medium
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Low
          </span>
        </div>
      </div>

      {/* Real waveform canvas */}
      <div className="relative cursor-crosshair">
        <canvas
          ref={canvasRef}
          className="h-44 w-full rounded-lg"
          style={{ imageRendering: "auto" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            setMouseX(null);
            setHoveredMarker(null);
          }}
        />

        {/* Tooltip */}
        {hoveredMarker && (
          <div
            className="absolute z-20 pointer-events-none glass-panel px-3 py-2 rounded-lg"
            style={{
              left: Math.min(tooltipPos.x + 10, (canvasRef.current?.offsetWidth || 300) - 200),
              top: Math.max(tooltipPos.y - 60, 5),
              minWidth: 180,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: hoveredMarker.severity === "high" ? "#ef4444" : hoveredMarker.severity === "medium" ? "#fbbf24" : "#00ff88",
                }}
              />
              <span
                className="font-mono text-[10px] font-bold uppercase"
                style={{
                  color: hoveredMarker.severity === "high" ? "#ef4444" : hoveredMarker.severity === "medium" ? "#fbbf24" : "#00ff88",
                }}
              >
                {hoveredMarker.severity} · {hoveredMarker.time_sec.toFixed(2)}s
              </span>
            </div>
            <p className="font-mono text-xs text-foreground leading-tight">
              {hoveredMarker.label}
            </p>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between font-mono text-xs text-muted-foreground/50">
        <span>0:00</span>
        <span>{formatTime(duration / 2)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
