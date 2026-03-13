import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAnalysis } from "@/hooks/useAnalysis";
import { FileInfoPanel } from "@/components/FileInfoPanel";
import { TrustLayerCard } from "@/components/TrustLayerCard";
import { WaveformViewer } from "@/components/WaveformViewer";
import { VerdictCard } from "@/components/VerdictCard";
import { UploadZone } from "@/components/UploadZone";
import FraudAnalysisPanel from "@/components/FraudAnalysisPanel";
import { Loader2, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const location = useLocation();
  const {
    isAnalyzing,
    analysisStep,
    result,
    error,
    analyze,
    generateReport,
    resetAnalysis,
  } = useAnalysis();

  // Stores updated fraud summary if user runs a manual transcript scan
  const [manualFraudSummary, setManualFraudSummary] = useState<any>(null);

  // Auto-start analysis when navigated here with a file
  useEffect(() => {
    const state = location.state as { file?: File } | null;
    if (state?.file) {
      analyze(state.file);
    }
  }, []);

  // Reset manual scan when a new file is analyzed
  useEffect(() => {
    setManualFraudSummary(null);
  }, [result]);

  const handleNewFile = (file: File) => {
    resetAnalysis();
    analyze(file);
  };

  // Handle manual transcript submission from FraudAnalysisPanel
  const handleManualTranscript = async (transcript: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/analyze/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (!res.ok) throw new Error(`Backend error ${res.status}`);
      const data = await res.json();

      // data.social_engineering_analysis matches the fraud_summary shape
      const se = data.social_engineering_analysis;
      setManualFraudSummary({
        threat_level: se.threat_level,
        fraud_intent_score: se.fraud_intent_score,
        sensitive_data_requested: se.sensitive_data_requested,
        authority_impersonation: se.authority_impersonation,
        urgency_level: se.urgency_level,
        recommended_action: se.recommended_action,
        plain_english_summary: se.plain_english_summary,
        flagged_segments: se.flagged_segments ?? [],
        transcript: transcript,
        asr_available: true, // manual counts as available
      });
    } catch (err) {
      console.error("Manual transcript scan failed:", err);
    }
  };

  // Pick which fraud summary to display:
  // manual scan overrides API result; API result used otherwise
  const activeFraudSummary =
    manualFraudSummary ?? (result as any)?.rawApiResult?.fraud_summary ?? null;

  // ── Empty state (Upload screen) ────────────────────────────────────────────
  if (!result && !isAnalyzing && !error) {
    return (
      <div className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden bg-background">
        {/* Animated Radar Background */}
        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-20 pointer-events-none">
          <div className="relative h-[800px] w-[800px] rounded-full border border-primary/20">
            <div className="absolute inset-4 rounded-full border border-primary/10" />
            <div className="absolute inset-16 rounded-full border border-primary/10" />
            <div className="absolute inset-32 rounded-full border border-primary/5" />
            <div className="absolute left-1/2 top-0 h-full w-[1px] bg-primary/20" />
            <div className="absolute top-1/2 left-0 h-[1px] w-full bg-primary/20" />
            <div className="absolute left-1/2 top-1/2 h-1/2 w-1/2 origin-top-left animate-radar bg-gradient-to-br from-primary/40 to-transparent blur-md" />
          </div>
        </div>

        <div className="relative z-10 w-full max-w-xl px-4 animate-fade-slide-in">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3" style={{ textShadow: "0 0 20px hsl(var(--primary)/0.3)" }}>
              AudioNotary <span className="text-primary font-mono text-3xl">API</span>
            </h1>
            <p className="text-muted-foreground font-mono text-sm max-w-md mx-auto">
              Initialize 7-layer forensic audit and voice clone detection pipeline. Waiting for audio input...
            </p>
          </div>
          <div className="transform transition-transform duration-500 hover:scale-[1.02]">
            <UploadZone onFileSelect={handleNewFile} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* Top bar */}
      <div className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50 px-4 py-2 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
              Secure Analysis Node
            </span>
            {result && (
              <>
                <span className="text-muted-foreground/50">/</span>
                <span
                  className={`font-mono text-xs font-bold ${
                    result.verdict.includes("AUTHENTIC")
                      ? "text-accent drop-shadow-[0_0_8px_rgba(0,255,136,0.5)]"
                      : result.verdict.includes("SUSPICIOUS")
                        ? "text-warning drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                        : "text-destructive drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                  }`}
                >
                  VERDICT: {result.verdict}
                </span>
              </>
            )}
          </div>
          <UploadZone
            onFileSelect={handleNewFile}
            compact
            label="Initialize new scan"
          />
        </div>
      </div>

      {/* ── Loading state (Immersive Forensic Scan) ──────────────────────────── */}
      {isAnalyzing && (
        <div className="relative flex min-h-[80vh] flex-col items-center justify-center p-4">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />
          
          <div className="relative z-10 w-full max-w-md bg-card/50 backdrop-blur-xl border border-primary/20 rounded-2xl p-8 shadow-[0_0_50px_rgba(0,255,136,0.05)] overflow-hidden">
            {/* Scanning Laser Effect */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-primary/70 shadow-[0_0_20px_rgba(0,255,136,1)] z-20 animate-[scan-line_2s_ease-in-out_infinite]" />
            
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative bg-background border border-primary/30 p-4 rounded-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              </div>
              
              <h3 className="font-mono text-lg font-bold text-foreground mb-1">
                EXECUTING TRUST AUDIT
              </h3>
              
              <div className="h-6 flex items-center justify-center mt-2 mb-6">
                <span className="font-mono text-sm text-primary typing-text">
                  {analysisStep || "Initializing 7-layer pipeline..."}
                </span>
              </div>
              
              <div className="w-full space-y-2 mt-4 text-left">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/50">
                  <div className="h-full w-1/3 rounded-full bg-primary animate-[scan-line_1.5s_linear_infinite]" />
                </div>
                <div className="flex justify-between font-mono text-[10px] text-muted-foreground opacity-70">
                  <span>ML DEEPFAKE CLASSIFIER</span>
                  <span className="animate-pulse">RUNNING...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Error state ────────────────────────────────────────────────────────── */}
      {error && !isAnalyzing && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
          <div className="w-full max-w-md forensic-card border-l-4 border-l-destructive">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h3 className="font-mono text-sm font-bold text-destructive">
                Analysis Failed
              </h3>
            </div>
            <p className="font-mono text-xs text-muted-foreground mb-4">
              {error}
            </p>
            <div className="space-y-1 font-mono text-xs text-muted-foreground mb-4">
              <p>Check the following:</p>
              <p>
                · Backend running? →{" "}
                <span className="text-primary">
                  uvicorn main:app --port 8001
                </span>
              </p>
              <p>
                · .env set? →{" "}
                <span className="text-primary">
                  VITE_API_URL=http://localhost:8001/api
                </span>
              </p>
              <p>· File format supported? → .mp3 .wav .flac .m4a .ogg .aac</p>
            </div>
            <UploadZone
              onFileSelect={handleNewFile}
              compact
              label="Try another file"
            />
          </div>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────────────── */}
      {result && !isAnalyzing && (
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left sidebar — File Info */}
            <div className="lg:col-span-3">
              <FileInfoPanel
                fileInfo={result.fileInfo}
                isAnalyzing={isAnalyzing}
              />
            </div>

            {/* Main content */}
            <div className="space-y-4 lg:col-span-6">
              {/* Trust Stack — 7 layers */}
              <div className="space-y-3">
                {result.layers.map((layer, i) => (
                  <TrustLayerCard
                    key={layer.id}
                    layer={layer}
                    index={i}
                    delay={i * 400}
                  />
                ))}
              </div>

              <FraudAnalysisPanel
                fraudSummary={activeFraudSummary}
                analysisId={result.fileInfo?.file_hash ?? ""}
                onManualTranscript={handleManualTranscript}
              />

              {/* Real waveform + spectrogram */}
              <WaveformViewer
                waveformEnvelope={result.waveformEnvelope ?? []}
                anomalyMarkers={(result.anomalies ?? []).map((a) => ({
                  time_sec: a.timestamp,
                  label: a.label,
                  severity:
                    a.severity === "suspicious"
                      ? "high"
                      : a.severity === "warning"
                        ? "medium"
                        : "low",
                }))}
                duration={result.fileInfo.duration}
                spectrogramB64={result.spectrogramB64}
              />

              {/* Frequency bands bar chart */}
              {result.frequencyBands && (
                <div className="forensic-card">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">
                    Frequency Band Analysis
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(result.frequencyBands).map(
                      ([band, energy]) => (
                        <div key={band} className="flex items-center gap-3">
                          <span className="w-24 font-mono text-xs text-muted-foreground capitalize">
                            {band.replace(/_/g, " ")}
                          </span>
                          <div className="h-2 flex-1 rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-700"
                              style={{
                                width: `${Math.round((energy as number) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="w-10 font-mono text-xs text-muted-foreground text-right">
                            {Math.round((energy as number) * 100)}%
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right panel — Verdict + Report */}
            <div className="lg:col-span-3">
              <div className="sticky top-20">
                <VerdictCard
                  result={result}
                  onGenerateReport={generateReport}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
