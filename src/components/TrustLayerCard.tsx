import { useEffect, useState } from "react";
import type { TrustLayer as TrustLayerType } from "@/hooks/useAnalysis";

interface TrustLayerCardProps {
  layer: TrustLayerType;
  delay: number;
}

function StatusChip({ status }: { status: string }) {
  const cls =
    status === "PASS"
      ? "status-pass"
      : status === "FAIL"
      ? "status-fail"
      : "status-warning";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

function ScoreBar({ score, delay }: { score: number; delay: number }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(score), delay);
    return () => clearTimeout(t);
  }, [score, delay]);

  const color =
    score >= 75
      ? "bg-accent"
      : score >= 50
      ? "bg-warning"
      : "bg-destructive";

  return (
    <div className="h-2 w-full rounded-full bg-secondary">
      <div
        className={`h-full rounded-full score-bar-fill ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function TrustLayerCard({ layer, delay }: TrustLayerCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!visible) return null;

  const borderColor =
    layer.status === "PASS"
      ? "border-l-accent"
      : layer.status === "FAIL"
      ? "border-l-destructive"
      : "border-l-warning";

  return (
    <div className={`forensic-card border-l-4 ${borderColor} animate-fade-slide-in`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{layer.icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Layer {layer.id} — {layer.name}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-bold text-foreground">{layer.score}</span>
          <StatusChip status={layer.status} />
        </div>
      </div>

      <ScoreBar score={layer.score} delay={200} />

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {layer.subMetrics.map((sub) => (
          <div key={sub.name} className="rounded bg-secondary/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">{sub.name}</p>
            <p className="font-mono text-sm font-semibold text-foreground">{sub.score}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}
