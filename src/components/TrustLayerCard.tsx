import { useEffect, useState } from "react";
import type { TrustLayer } from "@/hooks/useAnalysis";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

// ── Layer metadata for rich display ──────────────────────────────────────────

const LAYER_META: Record<string, {
  icon: string;
  description: string;
  color: string;
}> = {
  "Biological Signature": {
    icon: "🧬",
    description: "Detects micro-tremors, glottal pulse irregularity, and sub-glottal resonance unique to human vocal tracts",
    color: "from-purple-500/20 to-purple-900/5",
  },
  "Digital Integrity": {
    icon: "🔒",
    description: "Verifies metadata consistency, encoding artifacts, and compression fingerprints for tampering evidence",
    color: "from-blue-500/20 to-blue-900/5",
  },
  "Environmental Consistency": {
    icon: "🏠",
    description: "Analyzes room acoustics, background noise uniformity, and acoustic signature across the recording",
    color: "from-emerald-500/20 to-emerald-900/5",
  },
  "Temporal Coherence": {
    icon: "⏱️",
    description: "Checks breathing patterns, pause distribution, and prosody naturalness for speech rhythm anomalies",
    color: "from-amber-500/20 to-amber-900/5",
  },
  "Cross-Modal Fingerprint": {
    icon: "🔗",
    description: "Detects splice points via noise floor analysis, spectral discontinuity, and dynamic range integrity",
    color: "from-pink-500/20 to-pink-900/5",
  },
  "ML Deepfake Classifier": {
    icon: "🤖",
    description: "Neural network analysis using wav2vec2 model fine-tuned for synthetic speech detection",
    color: "from-cyan-500/20 to-cyan-900/5",
  },
  "Social Engineering Detection": {
    icon: "🚨",
    description: "Scans transcript for fraud patterns — sensitive data requests, authority impersonation, and urgency pressure",
    color: "from-red-500/20 to-red-900/5",
  },
};

// ── Sub-metric name formatting ───────────────────────────────────────────────

const SUB_METRIC_LABELS: Record<string, string> = {
  micro_tremor: "Micro-Tremor",
  glottal_pulse: "Glottal Pulse",
  subglottal_resonance: "Sub-Glottal Resonance",
  metadata_consistency: "Metadata",
  encoding_artifacts: "Encoding",
  compression_fingerprint: "Compression",
  room_impulse_response: "Room Acoustics",
  background_noise_uniformity: "Noise Floor",
  acoustic_signature: "Acoustic Signature",
  breathing_patterns: "Breathing",
  pause_distribution: "Pause Pattern",
  prosody_naturalness: "Prosody",
  noise_floor_consistency: "Noise Floor",
  splice_detection: "Splice Check",
  dynamic_range_integrity: "Dynamic Range",
  deepfake_classifier: "ML Verdict",
  fraud_intent_score: "Fraud Intent",
  sensitive_data_requested: "Data Request",
  authority_impersonation: "Authority Claim",
  urgency_pressure: "Urgency",
};

// ── Components ───────────────────────────────────────────────────────────────

interface TrustLayerCardProps {
  layer: TrustLayer;
  index: number;
  delay: number;
}

function StatusChip({ status }: { status: string }) {
  const cls =
    status === "PASS"
      ? "status-pass"
      : status === "FAIL"
        ? "status-fail"
        : "status-warning";
  const Icon =
    status === "PASS" ? CheckCircle2 : status === "FAIL" ? ShieldAlert : AlertTriangle;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${cls}`}
    >
      <Icon className="h-3 w-3" />
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
    <div className="h-2.5 w-full rounded-full bg-secondary/70 overflow-hidden">
      <div
        className={`h-full rounded-full ${color} score-bar-fill transition-all duration-700 ease-out`}
        style={{
          width: `${width}%`,
          boxShadow: score >= 75
            ? "0 0 8px hsl(155 100% 50% / 0.4)"
            : score >= 50
              ? "0 0 8px hsl(43 96% 56% / 0.4)"
              : "0 0 8px hsl(0 84% 60% / 0.4)",
        }}
      />
    </div>
  );
}

function MiniMetricBar({ score, label, anomaly, detail }: {
  score: number;
  label: string;
  anomaly?: boolean;
  detail?: string;
}) {
  const color =
    score >= 75 ? "bg-accent" : score >= 50 ? "bg-warning" : "bg-destructive";
  const textColor =
    score >= 75 ? "text-accent" : score >= 50 ? "text-warning" : "text-destructive";

  return (
    <div className="rounded-lg bg-secondary/30 border border-border/50 px-3 py-2.5 hover:border-border hover:bg-secondary/50 transition-all duration-200">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          {label}
        </p>
        <div className="flex items-center gap-1.5">
          {anomaly && (
            <AlertTriangle className="h-3 w-3 text-warning animate-pulse" />
          )}
          <span className={`font-mono text-sm font-bold ${textColor}`}>
            {score}
          </span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary/70 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      {detail && (
        <p className="mt-1.5 text-[10px] leading-tight text-muted-foreground/70 line-clamp-2">
          {detail}
        </p>
      )}
    </div>
  );
}

export function TrustLayerCard({ layer, index, delay }: TrustLayerCardProps) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!visible) return null;

  // Use rawLayer (ForensicLayer from API) for rich sub-metric data
  const raw = layer.rawLayer;

  const meta = LAYER_META[layer.name] ?? {
    icon: layer.icon ?? "🔍",
    description: "Forensic analysis layer",
    color: "from-slate-500/20 to-slate-900/5",
  };

  const borderColor =
    layer.status === "PASS"
      ? "border-l-accent"
      : layer.status === "FAIL"
        ? "border-l-destructive"
        : "border-l-warning";

  // Build sub-metrics from rawLayer.sub_metrics (rich API data)
  const subMetrics = raw?.sub_metrics
    ? Object.entries(raw.sub_metrics).map(([key, metric]) => ({
        key,
        label: SUB_METRIC_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        score: metric.score ?? 0,
        anomaly: metric.anomaly ?? false,
        detail: typeof metric.detail === "string" ? metric.detail : undefined,
      }))
    : layer.subMetrics.map((sm) => ({
        key: sm.name,
        label: sm.name,
        score: sm.score,
        anomaly: sm.anomaly ?? false,
        detail: undefined as string | undefined,
      }));

  // Get the most important detail text from sub-metrics
  const primaryDetail = subMetrics.find(m => m.detail && m.anomaly)?.detail
    ?? subMetrics.find(m => m.detail)?.detail;

  // ML Classifier detail
  const mlDetail = layer.name === "ML Deepfake Classifier"
    ? raw?.sub_metrics?.deepfake_classifier?.detail
    : undefined;

  // Error from raw layer
  const errorMsg = raw?.error;

  return (
    <div
      className={`forensic-card border-l-4 ${borderColor} animate-fade-slide-in overflow-hidden`}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${meta.color}`}>
            <span className="text-xl">{meta.icon}</span>
          </div>
          <div>
            <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
              Layer {index + 1}
            </span>
            <h3 className="text-sm font-semibold text-foreground leading-tight">
              {layer.name}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl font-bold text-foreground">
            {layer.score}
          </span>
          <StatusChip status={layer.status} />
          <button className="ml-1 text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── Score bar ───────────────────────────────────────────────────────── */}
      <div className="mt-3">
        <ScoreBar score={layer.score} delay={200} />
      </div>

      {/* ── Description ─────────────────────────────────────────────────────── */}
      <p className="mt-2 text-xs text-muted-foreground/80 leading-relaxed">
        {meta.description}
      </p>

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">{errorMsg}</p>
        </div>
      )}

      {/* ── Key finding (collapsed preview) ─────────────────────────────────── */}
      {primaryDetail && !expanded && (
        <div className="mt-2 rounded-md bg-secondary/30 border border-border/30 px-3 py-2">
          <p className="font-mono text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
            {String(primaryDetail)}
          </p>
        </div>
      )}

      {mlDetail && !expanded && (
        <div className="mt-2 rounded-md bg-secondary/30 border border-border/30 px-3 py-2">
          <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
            {String(mlDetail)}
          </p>
        </div>
      )}

      {/* ── Expanded sub-metrics ────────────────────────────────────────────── */}
      {expanded && subMetrics.length > 0 && (
        <div className="mt-3 space-y-2 animate-fade-slide-in">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60 mb-2">
            Sub-metric Breakdown
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {subMetrics.map((m) => (
              <MiniMetricBar
                key={m.key}
                score={m.score}
                label={m.label}
                anomaly={m.anomaly}
                detail={m.detail}
              />
            ))}
          </div>

          {mlDetail && (
            <div className="mt-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
              <p className="font-mono text-[11px] text-primary/90 leading-relaxed">
                {String(mlDetail)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
