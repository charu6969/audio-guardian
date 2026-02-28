import { useEffect, useRef } from "react";
import type { Anomaly } from "@/hooks/useAnalysis";

interface WaveformViewerProps {
  anomalies: Anomaly[];
  duration: number;
}

export function WaveformViewer({ anomalies, duration }: WaveformViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    // Background
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "#1f293744";
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Anomaly regions
    anomalies.forEach((a) => {
      const x = (a.timestamp / duration) * w;
      const regionW = w * 0.04;
      ctx.fillStyle =
        a.severity === "suspicious"
          ? "rgba(239, 68, 68, 0.15)"
          : a.severity === "warning"
          ? "rgba(251, 191, 36, 0.12)"
          : "rgba(0, 255, 136, 0.08)";
      ctx.fillRect(x - regionW / 2, 0, regionW, h);
    });

    // Waveform
    ctx.beginPath();
    ctx.strokeStyle = "#00d4ff";
    ctx.lineWidth = 1.5;
    const mid = h / 2;
    const steps = Math.floor(w / 2);

    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * w;
      const progress = i / steps;

      // Generate realistic-looking waveform
      const amp1 = Math.sin(progress * 30) * 0.3;
      const amp2 = Math.sin(progress * 67 + 1.2) * 0.2;
      const amp3 = Math.sin(progress * 120 + 0.5) * 0.15;
      const noise = (Math.random() - 0.5) * 0.1;
      const envelope = Math.sin(progress * Math.PI) * 0.8 + 0.2;
      const amplitude = (amp1 + amp2 + amp3 + noise) * envelope;

      const y = mid + amplitude * mid * 0.8;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Mirror waveform
    ctx.beginPath();
    ctx.strokeStyle = "#00d4ff66";
    ctx.lineWidth = 1;

    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * w;
      const progress = i / steps;
      const amp1 = Math.sin(progress * 30) * 0.3;
      const amp2 = Math.sin(progress * 67 + 1.2) * 0.2;
      const amp3 = Math.sin(progress * 120 + 0.5) * 0.15;
      const noise = (Math.random() - 0.5) * 0.1;
      const envelope = Math.sin(progress * Math.PI) * 0.8 + 0.2;
      const amplitude = (amp1 + amp2 + amp3 + noise) * envelope;

      const y = mid - amplitude * mid * 0.8;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Anomaly markers
    anomalies.forEach((a) => {
      const x = (a.timestamp / duration) * w;
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle =
        a.severity === "suspicious" ? "#ef4444" : a.severity === "warning" ? "#fbbf24" : "#00ff88";
      ctx.lineWidth = 1;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle =
        a.severity === "suspicious" ? "#ef4444" : a.severity === "warning" ? "#fbbf24" : "#00ff88";
      ctx.fillText(a.label, x + 4, 14);
    });

    // Center line
    ctx.beginPath();
    ctx.strokeStyle = "#1f293788";
    ctx.lineWidth = 1;
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();
  }, [anomalies, duration]);

  return (
    <div className="forensic-card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Waveform / Spectrogram Viewer</h3>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-destructive" /> Suspicious
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-warning" /> Warning
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" /> Clean
          </span>
        </div>
      </div>
      <canvas ref={canvasRef} className="h-40 w-full rounded-md" style={{ imageRendering: "auto" }} />
      <div className="mt-2 flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>0:00</span>
        <span>{Math.floor(duration / 2)}:{((duration / 2) % 1 * 60).toFixed(0).padStart(2, "0")}</span>
        <span>0:{duration.toString().padStart(2, "0")}</span>
      </div>
    </div>
  );
}
