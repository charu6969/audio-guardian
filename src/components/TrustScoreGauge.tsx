import { useEffect, useRef, useState } from "react";

interface TrustScoreGaugeProps {
  score: number;
  authenticityScore?: number;
  fraudRiskScore?: number;
  size?: number;
  className?: string;
}

export function TrustScoreGauge({
  score,
  authenticityScore,
  fraudRiskScore,
  size = 220,
  className = "",
}: TrustScoreGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const startTime = performance.now();
    const duration = 2000;
    let frame: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setAnimatedScore(Math.round(eased * score));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = (size * 0.65) * dpr;
    ctx.scale(dpr, dpr);

    const w = size;
    const h = size * 0.65;
    const cx = w / 2;
    const cy = h - 10;
    const radius = Math.min(w, h) * 0.7;
    const lineWidth = 12;

    ctx.clearRect(0, 0, w, h);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, 0);
    ctx.strokeStyle = "hsla(220, 20%, 15%, 0.8)";
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();

    // Gradient arc (score)
    const scoreAngle = Math.PI + (animatedScore / 100) * Math.PI;
    const gradient = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
    gradient.addColorStop(0, "hsl(0, 84%, 60%)");
    gradient.addColorStop(0.3, "hsl(25, 100%, 55%)");
    gradient.addColorStop(0.5, "hsl(43, 96%, 56%)");
    gradient.addColorStop(0.7, "hsl(155, 100%, 50%)");
    gradient.addColorStop(1, "hsl(189, 100%, 50%)");

    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, scoreAngle);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();

    // Glow effect on the arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, scoreAngle);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth + 8;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.15;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Needle
    const needleAngle = Math.PI + (animatedScore / 100) * Math.PI;
    const needleLen = radius - 20;
    const nx = cx + Math.cos(needleAngle) * needleLen;
    const ny = cy + Math.sin(needleAngle) * needleLen;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = "hsla(210, 20%, 90%, 0.8)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();

    // Needle dot
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "hsl(189, 100%, 50%)";
    ctx.fill();

    // Needle tip glow
    const tipGlow = ctx.createRadialGradient(nx, ny, 0, nx, ny, 10);
    tipGlow.addColorStop(0, "hsla(189, 100%, 70%, 0.6)");
    tipGlow.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(nx, ny, 10, 0, Math.PI * 2);
    ctx.fillStyle = tipGlow;
    ctx.fill();

    // Tick marks
    for (let i = 0; i <= 10; i++) {
      const tickAngle = Math.PI + (i / 10) * Math.PI;
      const innerR = radius + 8;
      const outerR = radius + (i % 5 === 0 ? 18 : 12);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(tickAngle) * innerR, cy + Math.sin(tickAngle) * innerR);
      ctx.lineTo(cx + Math.cos(tickAngle) * outerR, cy + Math.sin(tickAngle) * outerR);
      ctx.strokeStyle = `hsla(210, 20%, 60%, ${i % 5 === 0 ? 0.5 : 0.2})`;
      ctx.lineWidth = i % 5 === 0 ? 1.5 : 0.5;
      ctx.stroke();
    }
  }, [animatedScore, size]);

  const scoreColor = animatedScore >= 70 ? "hsl(155, 100%, 50%)" : animatedScore >= 45 ? "hsl(43, 96%, 56%)" : "hsl(0, 84%, 60%)";

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size * 0.65 }}
        />
        {/* Score display */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
          <span
            className="font-display text-4xl font-bold"
            style={{
              color: scoreColor,
              textShadow: `0 0 20px ${scoreColor}80, 0 0 40px ${scoreColor}30`,
            }}
          >
            {animatedScore}
          </span>
          <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
            Trust Score
          </div>
        </div>
      </div>

      {/* Sub-scores */}
      {(authenticityScore !== undefined || fraudRiskScore !== undefined) && (
        <div className="flex gap-6 mt-3">
          {authenticityScore !== undefined && (
            <div className="text-center">
              <div
                className="font-mono text-lg font-bold"
                style={{
                  color: authenticityScore >= 70 ? "hsl(155, 100%, 50%)" : authenticityScore >= 45 ? "hsl(43, 96%, 56%)" : "hsl(0, 84%, 60%)",
                }}
              >
                {authenticityScore}%
              </div>
              <div className="font-mono text-[9px] text-muted-foreground/50 uppercase">
                Authenticity
              </div>
            </div>
          )}
          {fraudRiskScore !== undefined && (
            <div className="text-center">
              <div
                className="font-mono text-lg font-bold"
                style={{
                  color: fraudRiskScore <= 30 ? "hsl(155, 100%, 50%)" : fraudRiskScore <= 60 ? "hsl(43, 96%, 56%)" : "hsl(0, 84%, 60%)",
                }}
              >
                {fraudRiskScore}%
              </div>
              <div className="font-mono text-[9px] text-muted-foreground/50 uppercase">
                Fraud Risk
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
