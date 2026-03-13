import { useEffect, useState } from "react";
import type { TrustLayer } from "@/hooks/useAnalysis";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

// ── Layer metadata for rich display ──────────────────────────────────────────

const LAYER_META: Record<string, {
  icon: string;
  description: string;
  gradient: string;
  accentColor: string;
}> = {
  "Biological Signature": {
    icon: "🧬",
    description: "Detects micro-tremors, glottal pulse irregularity, and sub-glottal resonance unique to human vocal tracts",
    gradient: "from-purple-500/20 to-purple-900/5",
    accentColor: "hsla(270, 100%, 65%, 0.5)",
  },
  "Digital Integrity": {
    icon: "🔒",
    description: "Verifies metadata consistency, encoding artifacts, and compression fingerprints for tampering evidence",
    gradient: "from-blue-500/20 to-blue-900/5",
    accentColor: "hsla(210, 100%, 60%, 0.5)",
  },
  "Environmental Consistency": {
    icon: "🏠",
    description: "Analyzes room acoustics, background noise uniformity, and acoustic signature across the recording",
    gradient: "from-emerald-500/20 to-emerald-900/5",
    accentColor: "hsla(155, 100%, 50%, 0.5)",
  },
  "Temporal Coherence": {
    icon: "⏱️",
    description: "Checks breathing patterns, pause distribution, and prosody naturalness for speech rhythm anomalies",
    gradient: "from-amber-500/20 to-amber-900/5",
    accentColor: "hsla(43, 96%, 56%, 0.5)",
  },
  "Cross-Modal Fingerprint": {
    icon: "🔗",
    description: "Detects splice points via noise floor analysis, spectral discontinuity, and dynamic range integrity",
    gradient: "from-pink-500/20 to-pink-900/5",
    accentColor: "hsla(330, 100%, 60%, 0.5)",
  },
  "ML Deepfake Classifier": {
    icon: "🤖",
    description: "Neural network analysis using wav2vec2 model fine-tuned for synthetic speech detection",
    gradient: "from-cyan-500/20 to-cyan-900/5",
    accentColor: "hsla(189, 100%, 50%, 0.5)",
  },
  "Social Engineering Detection": {
    icon: "🚨",
    description: "Scans transcript for fraud patterns — sensitive data requests, authority impersonation, and urgency pressure",
    gradient: "from-red-500/20 to-red-900/5",
    accentColor: "hsla(0, 84%, 60%, 0.5)",
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
  const config =
    status === "PASS"
      ? { cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400", Icon: CheckCircle2 }
      : status === "FAIL"
        ? { cls: "bg-red-500/10 border-red-500/30 text-red-400", Icon: ShieldAlert }
        : { cls: "bg-amber-500/10 border-amber-500/30 text-amber-400", Icon: AlertTriangle };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${config.cls}`}>
      <config.Icon className="h-3 w-3" />
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

  const gradient =
    score >= 75
      ? "from-emerald-400 to-green-500"
      : score >= 50
        ? "from-amber-400 to-yellow-500"
        : "from-red-400 to-rose-500";

  const glowColor =
    score >= 75
      ? "hsla(155, 100%, 50%, 0.4)"
      : score >= 50
        ? "hsla(43, 96%, 56%, 0.4)"
        : "hsla(0, 84%, 60%, 0.4)";

  return (
    <div className="h-2.5 w-full rounded-full bg-secondary/40 overflow-hidden">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${gradient} score-bar-fill`}
        style={{
          width: `${width}%`,
          boxShadow: `0 0 8px ${glowColor}`,
          transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
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
  const gradient =
    score >= 75
      ? "from-emerald-400 to-green-500"
      : score >= 50
        ? "from-amber-400 to-yellow-500"
        : "from-red-400 to-rose-500";
  const textColor =
    score >= 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <div className="rounded-lg bg-secondary/20 border border-border/30 px-3 py-2.5 hover:border-border/60 hover:bg-secondary/30 transition-all duration-200">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">
          {label}
        </p>
        <div className="flex items-center gap-1.5">
          {anomaly && (
            <AlertTriangle className="h-3 w-3 text-amber-400 animate-pulse" />
          )}
          <span className={`font-mono text-sm font-bold ${textColor}`}>
            {score}
          </span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary/50 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      {detail && (
        <p className="mt-1.5 text-[10px] leading-tight text-muted-foreground/60 line-clamp-2">
          {detail}
        </p>
      )}
    </div>
  );
}

export function TrustLayerCard({ layer, index, delay }: TrustLayerCardProps) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), delay);
    const t2 = setTimeout(() => setActivated(true), delay + 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [delay]);

  if (!visible) return null;

  const raw = layer.rawLayer;

  const meta = LAYER_META[layer.name] ?? {
    icon: layer.icon ?? "🔍",
    description: "Forensic analysis layer",
    gradient: "from-slate-500/20 to-slate-900/5",
    accentColor: "hsla(210, 30%, 50%, 0.5)",
  };

  const borderColor =
    layer.status === "PASS"
      ? "border-l-emerald-500"
      : layer.status === "FAIL"
        ? "border-l-red-500"
        : "border-l-amber-500";

  // Build sub-metrics
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

  const primaryDetail = subMetrics.find(m => m.detail && m.anomaly)?.detail
    ?? subMetrics.find(m => m.detail)?.detail;

  const mlDetail = layer.name === "ML Deepfake Classifier"
    ? raw?.sub_metrics?.deepfake_classifier?.detail
    : undefined;

  const errorMsg = raw?.error;

  return (
    <div
      className={`forensic-card border-l-4 ${borderColor} overflow-hidden ${
        activated ? "animate-layer-activate" : "opacity-0"
      }`}
      style={{
        animationDelay: `${index * 100}ms`,
      }}
    >
      {/* Layer activation glow bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-1000"
        style={{
          background: `linear-gradient(90deg, transparent, ${meta.accentColor}, transparent)`,
          opacity: activated ? 1 : 0,
        }}
      />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${meta.gradient}`}>
            <span className="text-xl">{meta.icon}</span>
          </div>
          <div>
            <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
              Layer {index + 1}
            </span>
            <h3 className="text-sm font-semibold text-foreground leading-tight">
              {layer.name}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="font-display text-2xl font-bold"
            style={{
              color: layer.score >= 70 ? "hsl(155, 100%, 50%)" : layer.score >= 45 ? "hsl(43, 96%, 56%)" : "hsl(0, 84%, 60%)",
              textShadow: layer.score >= 70
                ? "0 0 10px hsla(155, 100%, 50%, 0.3)"
                : layer.score >= 45
                  ? "0 0 10px hsla(43, 96%, 56%, 0.3)"
                  : "0 0 10px hsla(0, 84%, 60%, 0.3)",
            }}
          >
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
      <p className="mt-2 text-xs text-muted-foreground/60 leading-relaxed">
        {meta.description}
      </p>

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* ── Key finding (collapsed preview) ─────────────────────────────────── */}
      {primaryDetail && !expanded && (
        <div className="mt-2 rounded-lg bg-secondary/20 border border-border/20 px-3 py-2">
          <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-2">
            {String(primaryDetail)}
          </p>
        </div>
      )}

      {mlDetail && !expanded && (
        <div className="mt-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10 px-3 py-2">
          <p className="font-mono text-[11px] text-cyan-400/80 leading-relaxed">
            {String(mlDetail)}
          </p>
        </div>
      )}

      {/* ── Expanded sub-metrics ────────────────────────────────────────────── */}
      {expanded && subMetrics.length > 0 && (
        <div className="mt-3 space-y-2 animate-fade-slide-in">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/40 mb-2">
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
            <div className="mt-2 rounded-lg bg-cyan-500/5 border border-cyan-500/15 px-3 py-2">
              <p className="font-mono text-[11px] text-cyan-400/80 leading-relaxed">
                {String(mlDetail)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
