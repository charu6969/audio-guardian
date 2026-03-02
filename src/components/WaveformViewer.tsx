import { useEffect, useRef } from "react";

interface AnomalyMarker {
  time_sec: number;
  label: string;
  severity: "high" | "medium" | "low";
}

interface WaveformViewerProps {
  waveformEnvelope: number[]; // real data from API (400 floats)
  anomalyMarkers: AnomalyMarker[]; // real anomaly markers from API
  duration: number;
  spectrogramB64?: string | null; // real spectrogram PNG from API
}

export function WaveformViewer({
  waveformEnvelope,
  anomalyMarkers,
  duration,
  spectrogramB64,
}: WaveformViewerProps) {
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
    const mid = h / 2;

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

    // Anomaly regions (real data)
    anomalyMarkers.forEach((a) => {
      const x = (a.time_sec / duration) * w;
      const regionW = w * 0.04;
      ctx.fillStyle =
        a.severity === "high"
          ? "rgba(239, 68, 68, 0.15)"
          : a.severity === "medium"
            ? "rgba(251, 191, 36, 0.12)"
            : "rgba(0, 255, 136, 0.08)";
      ctx.fillRect(x - regionW / 2, 0, regionW, h);
    });

    // Real waveform from API envelope
    if (waveformEnvelope && waveformEnvelope.length > 0) {
      const maxAmp = Math.max(...waveformEnvelope, 0.001);

      // Upper waveform
      ctx.beginPath();
      ctx.strokeStyle = "#00d4ff";
      ctx.lineWidth = 1.5;
      waveformEnvelope.forEach((amp, i) => {
        const x = (i / (waveformEnvelope.length - 1)) * w;
        const y = mid - (amp / maxAmp) * mid * 0.85;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Mirror (lower)
      ctx.beginPath();
      ctx.strokeStyle = "#00d4ff66";
      ctx.lineWidth = 1;
      waveformEnvelope.forEach((amp, i) => {
        const x = (i / (waveformEnvelope.length - 1)) * w;
        const y = mid + (amp / maxAmp) * mid * 0.85;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Anomaly marker lines + labels (real data)
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

      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle =
        a.severity === "high"
          ? "#ef4444"
          : a.severity === "medium"
            ? "#fbbf24"
            : "#00ff88";
      ctx.fillText(a.label, x + 4, 14);
    });

    // Center line
    ctx.beginPath();
    ctx.strokeStyle = "#1f293788";
    ctx.lineWidth = 1;
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();
  }, [waveformEnvelope, anomalyMarkers, duration]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="forensic-card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Waveform / Spectrogram Viewer
        </h3>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-destructive" />{" "}
            High
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-warning" />{" "}
            Medium
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" /> Low
          </span>
        </div>
      </div>

      {/* Real spectrogram image from backend (shown above waveform if available) */}
      {spectrogramB64 && (
        <img
          src={`data:image/png;base64,${spectrogramB64}`}
          alt="Forensic Spectrogram"
          className="mb-2 w-full rounded-md"
          style={{ imageRendering: "auto" }}
        />
      )}

      {/* Real waveform canvas */}
      <canvas
        ref={canvasRef}
        className="h-40 w-full rounded-md"
        style={{ imageRendering: "auto" }}
      />

      <div className="mt-2 flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>0:00</span>
        <span>{formatTime(duration / 2)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
