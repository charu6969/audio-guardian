import { useState, useCallback } from "react";
import {
  analyzeAudio,
  analyzeAudioQuick,
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
  rawLayer?: ForensicLayer;
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
  authenticityScore: number;
  fraudRiskScore: number;
  verdict: string;
  anomalies: Anomaly[];
  caseId: string;
  spectrogramB64?: string | null;
  waveformEnvelope?: number[];
  frequencyBands?: Record<string, number>;
  rawApiResult?: ApiResult;
}

// ── Icon map ──────────────────────────────────────────────────────────────────

const LAYER_ICONS: Record<string, string> = {
  "Biological Signature": "🧬",
  "Digital Integrity": "🔒",
  "Environmental Consistency": "🏠",
  "Temporal Coherence": "⏱️",
  "Cross-Modal Fingerprint": "🔗",
  "ML Deepfake Classifier": "🤖",
  "Social Engineering Detection": "🚨",
};

// ── Adapter: convert API response → AnalysisResult shape ─────────────────────

function adaptApiResult(api: ApiResult): AnalysisResult {
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

  // Compute sub-scores
  const bioScore = layers.find(l => l.name.includes("Biological"))?.score || 50;
  const mlScore = layers.find(l => l.name.includes("Deepfake"))?.score || 50;
  const seScore = layers.find(l => l.name.includes("Social"))?.score;

  const authenticityScore = Math.round((bioScore * 0.4 + mlScore * 0.6));
  const fraudRiskScore = seScore !== undefined ? Math.round(100 - seScore) : 0;

  const anomalies: Anomaly[] = (viz?.anomaly_markers ?? []).map((m) => ({
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
    authenticityScore,
    fraudRiskScore,
    verdict: api.verdict,
    anomalies,
    caseId: crypto.randomUUID(),
    spectrogramB64: viz?.spectrogram_b64,
    waveformEnvelope: viz?.waveform_envelope,
    frequencyBands: viz?.frequency_bands as unknown as Record<string, number>,
    rawApiResult: api,
  };
}

// ── Analysis steps ────────────────────────────────────────────────────────────

const FULL_STEPS = [
  "Extracting spectral features...",
  "Running biological signature analysis...",
  "Checking digital integrity...",
  "Analyzing environmental consistency...",
  "Evaluating temporal coherence...",
  "Running ML deepfake classifier...",
  "Scanning for social engineering patterns...",
  "Generating forensic report...",
];

const QUICK_STEPS = [
  "Extracting spectral features...",
  "Running biological signature analysis...",
  "Evaluating temporal coherence...",
  "Analyzing environmental consistency...",
];

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<"quick" | "full">("full");
  const [activeLayerIndex, setActiveLayerIndex] = useState(-1);

  const runAnalysis = useCallback(async (file: File, mode: "quick" | "full") => {
    setIsAnalyzing(true);
    setResult(null);
    setError(null);
    setActiveLayerIndex(0);

    const steps = mode === "quick" ? QUICK_STEPS : FULL_STEPS;
    let stepIndex = 0;
    const stepInterval = setInterval(() => {
      if (stepIndex < steps.length - 1) {
        setAnalysisStep(steps[stepIndex]);
        setActiveLayerIndex(stepIndex);
        stepIndex++;
      }
    }, mode === "quick" ? 150 : 800);

    try {
      const apiResult = mode === "quick"
        ? await analyzeAudioQuick(file)
        : await analyzeAudio(file);
      clearInterval(stepInterval);
      setAnalysisStep("Analysis complete ✓");
      setActiveLayerIndex(-1);

      const adapted = adaptApiResult(apiResult);
      setResult(adapted);
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message || "Analysis failed — is the backend running?");
      setAnalysisStep("");
      setActiveLayerIndex(-1);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const analyze = useCallback((file: File) => runAnalysis(file, "full"), [runAnalysis]);
  const analyzeQuick = useCallback((file: File) => runAnalysis(file, "quick"), [runAnalysis]);

  const generateReport = useCallback(async () => {
    if (!result?.rawApiResult) return;
    try {
      await downloadReport(result.rawApiResult);
    } catch (err: any) {
      setError(err.message || "Report download failed");
    }
  }, [result]);

  const resetAnalysis = useCallback(() => {
    setResult(null);
    setError(null);
    setAnalysisStep("");
    setActiveLayerIndex(-1);
  }, []);

  return {
    isAnalyzing,
    analysisStep,
    result,
    error,
    analyze,
    analyzeQuick,
    generateReport,
    resetAnalysis,
    analysisMode,
    setAnalysisMode,
    activeLayerIndex,
    demoMode: "authentic" as const,
    toggleDemoMode: resetAnalysis,
  };
}
