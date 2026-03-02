import { useState, useCallback } from "react";
import {
  analyzeAudio,
  downloadReport,
  type AnalysisResult as ApiResult,
  type ForensicLayer,
} from "@/lib/audioNotaryApi";

// ── Types (kept compatible with existing components) ──────────────────────────

export interface FileInfo {
  name: string;
  size: number;
  duration: number;
  format: string;
  sampleRate: number;
  uploadTimestamp: Date;
  sha256: string;
}

export interface SubMetric {
  name: string;
  score: number;
  anomaly?: boolean;
}

export interface TrustLayer {
  id: number;
  icon: string;
  name: string;
  score: number;
  status: "PASS" | "FAIL" | "SUSPICIOUS";
  subMetrics: SubMetric[];
  rawLayer?: ForensicLayer; // full API layer attached for TrustLayerCard
}

export interface Anomaly {
  timestamp: number;
  severity: "clean" | "warning" | "suspicious";
  label: string;
}

export interface AnalysisResult {
  fileInfo: FileInfo;
  layers: TrustLayer[];
  overallScore: number;
  verdict: string;
  anomalies: Anomaly[];
  caseId: string;
  // Real extras from API
  spectrogramB64?: string | null;
  waveformEnvelope?: number[];
  frequencyBands?: Record<string, number>;
  rawApiResult?: ApiResult; // full API response kept for PDF report generation
}

// ── Icon map ──────────────────────────────────────────────────────────────────

const LAYER_ICONS: Record<string, string> = {
  "Biological Signature": "🧬",
  "Digital Integrity": "🔒",
  "Environmental Consistency": "🏠",
  "Temporal Coherence": "⏱️",
  "Cross-Modal Fingerprint": "🔗",
  "ML Deepfake Classifier": "🤖",
};

// ── Adapter: convert API response → AnalysisResult shape ─────────────────────

function adaptApiResult(api: ApiResult, file: File): AnalysisResult {
  const meta = api.file_metadata;
  const viz = api.visualization;

  const fileInfo: FileInfo = {
    name: meta.filename,
    size: meta.file_size_bytes,
    duration: meta.duration_sec,
    format: meta.format,
    sampleRate: meta.sample_rate,
    uploadTimestamp: new Date(),
    sha256: meta.file_hash,
  };

  // Map API layers → TrustLayer[]
  const layers: TrustLayer[] = api.layers.map((l, i) => {
    const subMetrics: SubMetric[] = Object.entries(l.sub_metrics ?? {}).map(
      ([key, val]) => ({
        name: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        score: val.score ?? 0,
        anomaly: val.anomaly ?? false,
      }),
    );

    return {
      id: i + 1,
      icon: LAYER_ICONS[l.layer] ?? "🔍",
      name: l.layer,
      score: l.score,
      status: l.status,
      subMetrics,
      rawLayer: l,
    };
  });

  // Map API anomaly markers → Anomaly[]
  const anomalies: Anomaly[] = (viz.anomaly_markers ?? []).map((m) => ({
    timestamp: m.time_sec,
    severity:
      m.severity === "high"
        ? "suspicious"
        : m.severity === "medium"
          ? "warning"
          : "clean",
    label: m.label,
  }));

  return {
    fileInfo,
    layers,
    overallScore: api.trust_score,
    verdict: api.verdict,
    anomalies,
    caseId: crypto.randomUUID(),
    spectrogramB64: viz.spectrogram_b64,
    waveformEnvelope: viz.waveform_envelope,
    frequencyBands: viz.frequency_bands as Record<string, number>,
    rawApiResult: api,
  };
}

// ── Analysis steps shown in UI while waiting ──────────────────────────────────

const ANALYSIS_STEPS = [
  "Extracting spectral features...",
  "Running biological signature analysis...",
  "Checking digital integrity...",
  "Analyzing environmental consistency...",
  "Evaluating temporal coherence...",
  "Running ML deepfake classifier...",
  "Generating forensic report...",
];

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (file: File) => {
    setIsAnalyzing(true);
    setResult(null);
    setError(null);

    // Animate steps while API call runs in parallel
    let stepIndex = 0;
    const stepInterval = setInterval(() => {
      if (stepIndex < ANALYSIS_STEPS.length - 1) {
        setAnalysisStep(ANALYSIS_STEPS[stepIndex]);
        stepIndex++;
      }
    }, 800);

    try {
      // Real API call
      const apiResult = await analyzeAudio(file);
      clearInterval(stepInterval);
      setAnalysisStep("Analysis complete ✓");

      const adapted = adaptApiResult(apiResult, file);
      setResult(adapted);
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message || "Analysis failed — is the backend running?");
      setAnalysisStep("");
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const generateReport = useCallback(async () => {
    if (!result?.rawApiResult) return;
    try {
      await downloadReport(result.rawApiResult);
    } catch (err: any) {
      setError(err.message || "Report download failed");
    }
  }, [result]);

  // Kept for UI toggle compatibility — re-runs analysis is not needed since
  // the result is now real. This just clears result so user can re-upload.
  const resetAnalysis = useCallback(() => {
    setResult(null);
    setError(null);
    setAnalysisStep("");
  }, []);

  return {
    isAnalyzing,
    analysisStep,
    result,
    error,
    analyze,
    generateReport,
    resetAnalysis,
    // Legacy compat: toggleDemoMode is a no-op (real data doesn't need it)
    demoMode: "authentic" as const,
    toggleDemoMode: resetAnalysis,
  };
}
