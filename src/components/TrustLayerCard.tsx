import { useEffect, useState } from "react";
import type { ForensicLayer } from "@/lib/audioNotaryApi";

// Icon map for each layer name
const LAYER_ICONS: Record<string, string> = {
  "Biological Signature": "🧬",
  "Digital Integrity": "🔒",
  "Environmental Consistency": "🏠",
  "Temporal Coherence": "⏱️",
  "Cross-Modal Fingerprint": "🔗",
  "ML Deepfake Classifier": "🤖",
};

interface TrustLayerCardProps {
  layer: ForensicLayer; // real API type from audioNotaryApi.ts
  index: number; // for display numbering
  delay: number;
}

function StatusChip({ status }: { status: "PASS" | "SUSPICIOUS" | "FAIL" }) {
  const cls =
    status === "PASS"
      ? "status-pass"
      : status === "FAIL"
        ? "status-fail"
        : "status-warning";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${cls}`}
    >
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
    score >= 75 ? "bg-accent" : score >= 50 ? "bg-warning" : "bg-destructive";

  return (
    <div className="h-2 w-full rounded-full bg-secondary">
      <div
        className={`h-full rounded-full score-bar-fill ${color} transition-all duration-700 ease-out`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function TrustLayerCard({ layer, index, delay }: TrustLayerCardProps) {
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

  const icon = LAYER_ICONS[layer.layer] ?? "🔍";

  // Convert sub_metrics object → array for display
  const subMetricEntries = Object.entries(layer.sub_metrics ?? {}).slice(0, 3);

  return (
    <div
      className={`forensic-card border-l-4 ${borderColor} animate-fade-slide-in`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Layer {index + 1} — {layer.layer}
            </h3>
            {layer.error && (
              <p className="text-xs text-destructive">⚠ {layer.error}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-bold text-foreground">
            {layer.score}
          </span>
          <StatusChip status={layer.status} />
        </div>
      </div>

      <ScoreBar score={layer.score} delay={200} />

      {/* Sub-metrics from real API data */}
      {subMetricEntries.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {subMetricEntries.map(([key, metric]) => (
            <div key={key} className="rounded bg-secondary/50 px-3 py-2">
              <p className="text-xs text-muted-foreground capitalize">
                {key.replace(/_/g, " ")}
              </p>
              <p className="font-mono text-sm font-semibold text-foreground">
                {metric.score}%
              </p>
              {metric.anomaly && (
                <p className="text-xs text-warning mt-0.5">⚠ anomaly</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail text for ML classifier */}
      {layer.layer === "ML Deepfake Classifier" &&
        layer.sub_metrics?.deepfake_classifier?.detail && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {String(layer.sub_metrics.deepfake_classifier.detail)}
          </p>
        )}
    </div>
  );
}
