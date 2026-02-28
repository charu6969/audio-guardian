import { useEffect, useRef, useState } from "react";
import type { AnalysisResult } from "@/hooks/useAnalysis";
import { Button } from "@/components/ui/button";
import { FileText, Link2 } from "lucide-react";

interface VerdictCardProps {
  result: AnalysisResult;
  onGenerateReport: () => void;
}

function TrustRing({ score }: { score: number }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const dur = 1500;

    const animate = (now: number) => {
      const progress = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
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

    const size = 140;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = 58;
    const lineWidth = 8;

    ctx.clearRect(0, 0, size, size);

    // Background ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Score ring
    const angle = (animatedScore / 100) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, angle);
    const color = score >= 70 ? "#00ff88" : score >= 45 ? "#fbbf24" : "#ef4444";
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();
  }, [animatedScore, score]);

  return (
    <div className="relative flex items-center justify-center">
      <canvas ref={canvasRef} className="trust-ring" style={{ width: 140, height: 140 }} />
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-3xl font-bold text-foreground">{animatedScore}</span>
        <span className="text-xs text-muted-foreground">Trust Score</span>
      </div>
    </div>
  );
}

export function VerdictCard({ result, onGenerateReport }: VerdictCardProps) {
  const verdictClass =
    result.verdict === "AUTHENTIC"
      ? "verdict-authentic"
      : result.verdict === "SUSPICIOUS"
      ? "verdict-suspicious"
      : "verdict-synthetic";

  return (
    <div className="forensic-card space-y-6">
      <div className="text-center">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Final Verdict
        </p>
        <h2 className={`pulse-once font-mono text-2xl font-bold ${verdictClass}`}>
          {result.verdict}
        </h2>
      </div>

      <div className="flex justify-center">
        <TrustRing score={result.overallScore} />
      </div>

      {/* Confidence breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Layer Confidence
        </p>
        {result.layers.map((layer) => (
          <div key={layer.id} className="flex items-center gap-2">
            <span className="text-sm">{layer.icon}</span>
            <div className="flex-1">
              <div className="h-1.5 w-full rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full score-bar-fill ${
                    layer.score >= 75 ? "bg-accent" : layer.score >= 50 ? "bg-warning" : "bg-destructive"
                  }`}
                  style={{ width: `${layer.score}%` }}
                />
              </div>
            </div>
            <span className="font-mono text-xs text-muted-foreground">{layer.score}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Button
          className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={onGenerateReport}
        >
          <FileText className="h-4 w-4" />
          Generate Forensic Report
        </Button>
        <Button variant="outline" className="w-full gap-2 border-border text-foreground hover:bg-secondary">
          <Link2 className="h-4 w-4" />
          Compare with Reference Audio
        </Button>
      </div>
    </div>
  );
}
