/**
 * AudioNotary API Client  (v2 — updated for port 8080 + ML layer + real spectrogram)
 * Drop into: src/lib/audioNotaryApi.ts
 *
 * Set in your .env:
 *   VITE_API_URL=http://localhost:8000/api
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SubMetric {
  score: number;
  detail: string;
  anomaly: boolean;
  [key: string]: unknown;
}

export interface ForensicLayer {
  layer: string;
  score: number;
  status: "PASS" | "SUSPICIOUS" | "FAIL";
  anomaly_detected: boolean;
  sub_metrics: Record<string, SubMetric>;
  file_hash?: string;
  error?: string;
}

export interface AnomalyMarker {
  time_sec: number;
  label: string;
  severity: "high" | "medium" | "low";
}

export interface FrequencyBands {
  sub_bass: number;
  bass: number;
  mid: number;
  upper_mid: number;
  presence: number;
  air: number;
}

export interface VisualizationData {
  spectrogram_b64: string | null; // base64 PNG — render with <img src={`data:image/png;base64,${v.spectrogram_b64}`} />
  waveform_envelope: number[]; // 400 amplitude values for canvas waveform
  frequency_bands: FrequencyBands; // 6-band energy breakdown for bar chart
  anomaly_markers: AnomalyMarker[]; // detected anomalies with timestamps
  duration_sec: number;
  sample_rate: number;
}

export interface FileMetadata {
  filename: string;
  file_size_bytes: number;
  duration_sec: number;
  sample_rate: number;
  format: string;
  file_hash: string;
}

export interface AnalysisResult {
  success: boolean;
  verdict:
    | "AUTHENTIC"
    | "LIKELY AUTHENTIC"
    | "SUSPICIOUS"
    | "LIKELY SYNTHETIC"
    | "SYNTHETIC / MANIPULATED";
  trust_score: number;
  file_metadata: FileMetadata;
  layers: ForensicLayer[];
  visualization: VisualizationData;
}

export interface CompareResult {
  success: boolean;
  voice_similarity_score: number;
  clone_verdict: string;
  risk_level: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  disputed_file_ml_analysis: ForensicLayer;
  reference_file: string;
  disputed_file: string;
}

// ── API Functions ─────────────────────────────────────────────────────────────

/** Upload an audio file and receive a full forensic analysis. */
export async function analyzeAudio(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${response.status}`);
  }

  return response.json() as Promise<AnalysisResult>;
}

/** Download a PDF forensic report. Triggers browser download. */
export async function downloadReport(
  analysisResult: AnalysisResult,
): Promise<void> {
  const response = await fetch(`${API_BASE}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(analysisResult),
  });

  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ detail: "Report generation failed" }));
    throw new Error(err.detail);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AudioNotary_Report_${analysisResult.file_metadata.filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Voice clone detection between two files. */
export async function compareAudio(
  referenceFile: File,
  disputedFile: File,
): Promise<CompareResult> {
  const formData = new FormData();
  formData.append("reference", referenceFile);
  formData.append("disputed", disputedFile);

  const response = await fetch(`${API_BASE}/compare`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ detail: "Comparison failed" }));
    throw new Error(err.detail || `HTTP ${response.status}`);
  }

  return response.json() as Promise<CompareResult>;
}

/** Health check — verify backend is reachable. */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE.replace("/api", "")}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Spectrogram helper ────────────────────────────────────────────────────────

/**
 * Returns a ready-to-use img src string for the spectrogram.
 * Usage: <img src={getSpectrogramSrc(result)} className="w-full rounded" />
 */
export function getSpectrogramSrc(result: AnalysisResult): string | null {
  const b64 = result.visualization?.spectrogram_b64;
  return b64 ? `data:image/png;base64,${b64}` : null;
}

/**
 * Returns verdict color for styling.
 */
export function verdictColor(verdict: string): string {
  if (verdict.includes("AUTHENTIC")) return "#00ff88";
  if (verdict.includes("SUSPICIOUS")) return "#fbbf24";
  return "#ef4444";
}

/**
 * Returns layer status color.
 */
export function statusColor(status: "PASS" | "SUSPICIOUS" | "FAIL"): string {
  if (status === "PASS") return "#00ff88";
  if (status === "SUSPICIOUS") return "#fbbf24";
  return "#ef4444";
}
