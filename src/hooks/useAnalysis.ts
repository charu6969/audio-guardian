import { useState, useCallback } from "react";

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
}

export interface TrustLayer {
  id: number;
  icon: string;
  name: string;
  score: number;
  status: "PASS" | "FAIL" | "SUSPICIOUS";
  subMetrics: SubMetric[];
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
  verdict: "AUTHENTIC" | "SUSPICIOUS" | "LIKELY SYNTHETIC";
  anomalies: Anomaly[];
  caseId: string;
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateHash(): string {
  const chars = "0123456789abcdef";
  return Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * 16)]).join("");
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getStatus(score: number): "PASS" | "FAIL" | "SUSPICIOUS" {
  if (score >= 75) return "PASS";
  if (score >= 50) return "SUSPICIOUS";
  return "FAIL";
}

function generateAuthenticData(): Omit<AnalysisResult, "fileInfo" | "caseId"> {
  const layerDefs = [
    { icon: "🧬", name: "Biological Signature", subs: ["Micro-tremor Detection", "Glottal Pulse Irregularity", "Sub-glottal Resonance"] },
    { icon: "🔒", name: "Digital Integrity", subs: ["Metadata Consistency", "Encoding Artifacts", "Compression Fingerprint"] },
    { icon: "🏠", name: "Environmental Consistency", subs: ["Room Impulse Response Stability", "Background Noise Uniformity", "Acoustic Signature Match"] },
    { icon: "⏱️", name: "Temporal Coherence", subs: ["Breathing Pattern Analysis", "Pause Distribution", "Prosody Naturalness"] },
    { icon: "🔗", name: "Cross-Modal Fingerprint", subs: ["Noise Floor Consistency", "Splice Detection", "Dynamic Range Integrity"] },
  ];

  const layers: TrustLayer[] = layerDefs.map((def, i) => {
    const score = randomBetween(72, 96);
    return {
      id: i + 1,
      icon: def.icon,
      name: def.name,
      score,
      status: getStatus(score),
      subMetrics: def.subs.map((name) => ({ name, score: randomBetween(68, 98) })),
    };
  });

  const overallScore = Math.round(layers.reduce((sum, l) => sum + l.score, 0) / layers.length);

  const anomalies: Anomaly[] = [
    { timestamp: 2.3, severity: "clean", label: "Clean segment verified" },
    { timestamp: 5.1, severity: "warning", label: "Minor background shift" },
    { timestamp: 8.7, severity: "clean", label: "Natural pause pattern" },
    { timestamp: 12.4, severity: "clean", label: "Consistent vocal signature" },
  ];

  return { layers, overallScore, verdict: "AUTHENTIC", anomalies };
}

function generateSyntheticData(): Omit<AnalysisResult, "fileInfo" | "caseId"> {
  const layerDefs = [
    { icon: "🧬", name: "Biological Signature", subs: ["Micro-tremor Detection", "Glottal Pulse Irregularity", "Sub-glottal Resonance"] },
    { icon: "🔒", name: "Digital Integrity", subs: ["Metadata Consistency", "Encoding Artifacts", "Compression Fingerprint"] },
    { icon: "🏠", name: "Environmental Consistency", subs: ["Room Impulse Response Stability", "Background Noise Uniformity", "Acoustic Signature Match"] },
    { icon: "⏱️", name: "Temporal Coherence", subs: ["Breathing Pattern Analysis", "Pause Distribution", "Prosody Naturalness"] },
    { icon: "🔗", name: "Cross-Modal Fingerprint", subs: ["Noise Floor Consistency", "Splice Detection", "Dynamic Range Integrity"] },
  ];

  const layers: TrustLayer[] = layerDefs.map((def, i) => {
    const score = randomBetween(15, 48);
    return {
      id: i + 1,
      icon: def.icon,
      name: def.name,
      score,
      status: getStatus(score),
      subMetrics: def.subs.map((name) => ({ name, score: randomBetween(10, 55) })),
    };
  });

  const overallScore = Math.round(layers.reduce((sum, l) => sum + l.score, 0) / layers.length);

  const anomalies: Anomaly[] = [
    { timestamp: 1.2, severity: "suspicious", label: "Noise floor shift detected" },
    { timestamp: 3.8, severity: "suspicious", label: "Unnatural pause gap" },
    { timestamp: 6.5, severity: "warning", label: "Compression artifact anomaly" },
    { timestamp: 9.1, severity: "suspicious", label: "Splice boundary detected" },
    { timestamp: 11.3, severity: "suspicious", label: "Missing micro-tremor pattern" },
  ];

  return { layers, overallScore, verdict: "LIKELY SYNTHETIC", anomalies };
}

const ANALYSIS_STEPS = [
  "Extracting spectral features...",
  "Running biological signature analysis...",
  "Checking digital integrity...",
  "Analyzing environmental consistency...",
  "Evaluating temporal coherence...",
  "Generating forensic report...",
];

export function useAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [demoMode, setDemoMode] = useState<"authentic" | "synthetic">("authentic");

  const analyze = useCallback(
    (file: File) => {
      setIsAnalyzing(true);
      setResult(null);

      const fileInfo: FileInfo = {
        name: file.name,
        size: file.size,
        duration: randomBetween(8, 45),
        format: file.name.split(".").pop()?.toUpperCase() || "WAV",
        sampleRate: [44100, 48000, 22050][randomBetween(0, 2)],
        uploadTimestamp: new Date(),
        sha256: generateHash(),
      };

      let stepIndex = 0;
      const interval = setInterval(() => {
        if (stepIndex < ANALYSIS_STEPS.length) {
          setAnalysisStep(ANALYSIS_STEPS[stepIndex]);
          stepIndex++;
        } else {
          clearInterval(interval);
          const data = demoMode === "authentic" ? generateAuthenticData() : generateSyntheticData();
          setResult({ ...data, fileInfo, caseId: generateUUID() });
          setIsAnalyzing(false);
          setAnalysisStep("");
        }
      }, 600);
    },
    [demoMode]
  );

  const toggleDemoMode = useCallback(() => {
    const newMode = demoMode === "authentic" ? "synthetic" : "authentic";
    setDemoMode(newMode);
    if (result) {
      const data = newMode === "authentic" ? generateAuthenticData() : generateSyntheticData();
      setResult({ ...data, fileInfo: result.fileInfo, caseId: result.caseId });
    }
  }, [demoMode, result]);

  return { isAnalyzing, analysisStep, result, demoMode, analyze, toggleDemoMode };
}
