import { useEffect, useRef, useState } from "react";

interface AnalysisRadarProps {
  scores: Record<string, number>;
  animated?: boolean;
  size?: number;
  className?: string;
}

const AXES = [
  { key: "biological", label: "Bio", color: "hsl(270, 90%, 60%)" },
  { key: "integrity", label: "Integrity", color: "hsl(250, 85%, 65%)" },
  { key: "environment", label: "Environ", color: "hsl(295, 95%, 60%)" },
  { key: "temporal", label: "Temporal", color: "hsl(310, 90%, 55%)" },
  { key: "deepfake", label: "Deepfake", color: "hsl(330, 90%, 60%)" },
  { key: "fraud", label: "Fraud", color: "hsl(345, 85%, 55%)" },
];

export function AnalysisRadar({ scores, animated = true, size = 260, className = "" }: AnalysisRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const progressRef = useRef(0);
  const [currentScores, setCurrentScores] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!animated) {
      setCurrentScores(scores);
      return;
    }

    progressRef.current = 0;
    const startTime = performance.now();
    const duration = 2000;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      const interpolated: Record<string, number> = {};
      AXES.forEach(axis => {
        interpolated[axis.key] = (scores[axis.key] || 0) * eased;
      });
      setCurrentScores(interpolated);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [scores, animated]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const maxR = size / 2 - 30;

    ctx.clearRect(0, 0, size, size);

    // Draw concentric rings
    for (let ring = 1; ring <= 4; ring++) {
      const r = (maxR / 4) * ring;
      ctx.beginPath();
      for (let i = 0; i <= AXES.length; i++) {
        const angle = (Math.PI * 2 / AXES.length) * i - Math.PI / 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `hsla(270, 60%, 75%, ${0.2 + ring * 0.1})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw axis lines
    AXES.forEach((_, i) => {
      const angle = (Math.PI * 2 / AXES.length) * i - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
      ctx.strokeStyle = "hsla(270, 60%, 75%, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw data polygon (filled)
    ctx.beginPath();
    AXES.forEach((axis, i) => {
      const value = (currentScores[axis.key] || 0) / 100;
      const angle = (Math.PI * 2 / AXES.length) * i - Math.PI / 2;
      const r = value * maxR;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();

    // Gradient fill
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    gradient.addColorStop(0, "hsla(270, 90%, 65%, 0.25)");
    gradient.addColorStop(0.5, "hsla(295, 95%, 65%, 0.15)");
    gradient.addColorStop(1, "hsla(310, 90%, 60%, 0.05)");
    ctx.fillStyle = gradient;
    ctx.fill();

    // Border
    ctx.strokeStyle = "hsla(270, 90%, 65%, 0.8)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw data points and labels
    AXES.forEach((axis, i) => {
      const value = (currentScores[axis.key] || 0) / 100;
      const angle = (Math.PI * 2 / AXES.length) * i - Math.PI / 2;
      const r = value * maxR;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      // Point glow
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 8);
      glow.addColorStop(0, axis.color.replace(")", ", 0.8)").replace("hsl(", "hsla("));
      glow.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Point
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = axis.color;
      ctx.fill();

      // Label
      const labelR = maxR + 18;
      const lx = cx + Math.cos(angle) * labelR;
      const ly = cy + Math.sin(angle) * labelR;
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = "hsla(270, 40%, 35%, 0.9)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(axis.label, lx, ly);
    });

  }, [currentScores, size]);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
      />
      <span className="mt-1 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
        Analysis Radar
      </span>
    </div>
  );
}
