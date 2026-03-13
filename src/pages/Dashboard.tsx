import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAnalysis } from "@/hooks/useAnalysis";
import { FileInfoPanel } from "@/components/FileInfoPanel";
import { TrustLayerCard } from "@/components/TrustLayerCard";
import { WaveformViewer } from "@/components/WaveformViewer";
import { VerdictCard } from "@/components/VerdictCard";
import { UploadZone } from "@/components/UploadZone";
import FraudAnalysisPanel from "@/components/FraudAnalysisPanel";
import { NeuralNetworkViz } from "@/components/NeuralNetworkViz";
import { AnalysisRadar } from "@/components/AnalysisRadar";
import { ParticleVisualizer } from "@/components/ParticleVisualizer";
import { MouseGlowEffect } from "@/components/MouseGlowEffect";
import { SpectrogramHeatmap } from "@/components/SpectrogramHeatmap";
import { AnalysisModeSelector } from "@/components/AnalysisModeSelector";
import { Loader2, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const location = useLocation();
  const {
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
  } = useAnalysis();

  const [manualFraudSummary, setManualFraudSummary] = useState<any>(null);

  // Auto-start analysis when navigated here with a file
  useEffect(() => {
    const state = location.state as { file?: File } | null;
    if (state?.file) {
      if (analysisMode === "quick") {
        analyzeQuick(state.file);
      } else {
        analyze(state.file);
      }
    }
  }, []);

  useEffect(() => {
    setManualFraudSummary(null);
  }, [result]);

  const handleNewFile = (file: File) => {
    resetAnalysis();
    if (analysisMode === "quick") {
      analyzeQuick(file);
    } else {
      analyze(file);
    }
  };

  const handleManualTranscript = async (transcript: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/analyze/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (!res.ok) throw new Error(`Backend error ${res.status}`);
      const data = await res.json();
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
        asr_available: true,
      });
    } catch (err) {
      console.error("Manual transcript scan failed:", err);
    }
  };

  const activeFraudSummary =
    manualFraudSummary ?? (result as any)?.rawApiResult?.fraud_summary ?? null;

  // Build radar scores from result
  const radarScores = result
    ? {
        biological: result.layers.find(l => l.name.includes("Biological"))?.score || 0,
        integrity: result.layers.find(l => l.name.includes("Digital"))?.score || 0,
        environment: result.layers.find(l => l.name.includes("Environmental"))?.score || 0,
        temporal: result.layers.find(l => l.name.includes("Temporal"))?.score || 0,
        deepfake: result.layers.find(l => l.name.includes("Deepfake"))?.score || 0,
        fraud: result.layers.find(l => l.name.includes("Social"))?.score || 50,
      }
    : {};

  // ── Empty state (Upload screen) ────────────────────────────────────────────
  if (!result && !isAnalyzing && !error) {
    return (
      <MouseGlowEffect className="min-h-[calc(100vh-3.5rem)]">
        <div className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden bg-background">
          {/* Particle background */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <ParticleVisualizer />
          </div>

          {/* Animated Radar Background */}
          <div className="absolute inset-0 z-0 flex items-center justify-center opacity-15 pointer-events-none">
            <div className="relative h-[800px] w-[800px] rounded-full border border-cyan-500/20">
              <div className="absolute inset-4 rounded-full border border-purple-500/10" />
              <div className="absolute inset-16 rounded-full border border-cyan-500/10" />
              <div className="absolute inset-32 rounded-full border border-purple-500/5" />
              <div className="absolute left-1/2 top-0 h-full w-[1px] bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent" />
              <div className="absolute top-1/2 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
              <div className="absolute left-1/2 top-1/2 h-1/2 w-1/2 origin-top-left animate-radar bg-gradient-to-br from-cyan-400/30 via-purple-500/20 to-transparent blur-lg" />
            </div>
          </div>

          <div className="relative z-10 w-full max-w-2xl px-4 animate-fade-slide-in">
            <div className="text-center mb-8">
              <h1 className="text-5xl font-bold tracking-tight text-foreground mb-3">
                <span className="font-display bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  AudioNotary
                </span>
              </h1>
              <p className="text-muted-foreground font-mono text-sm max-w-md mx-auto">
                Initialize forensic audit and voice clone detection pipeline. Select analysis mode and upload audio.
              </p>
            </div>

            {/* Mode Selector */}
            <div className="mb-6">
              <AnalysisModeSelector
                mode={analysisMode}
                onModeChange={setAnalysisMode}
              />
            </div>

            <div className="transform transition-transform duration-500 hover:scale-[1.01]">
              <UploadZone onFileSelect={handleNewFile} />
            </div>
          </div>
        </div>
      </MouseGlowEffect>
    );
  }

  return (
    <MouseGlowEffect className="min-h-[calc(100vh-3.5rem)]">
      {/* Particle background (subtle) */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30">
        <ParticleVisualizer
          isAnalyzing={isAnalyzing}
          activeLayer={activeLayerIndex}
          score={result?.overallScore}
        />
      </div>

      {/* Top bar */}
      <div className="glass-panel sticky top-0 z-50 px-4 py-2 shadow-lg border-b border-cyan-500/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${isAnalyzing ? "bg-cyan-400 animate-pulse" : "bg-accent"}`}
              style={{ boxShadow: isAnalyzing ? "0 0 8px hsl(189, 100%, 50%)" : "0 0 8px hsl(155, 100%, 50%)" }}
            />
            <span className="font-mono text-xs font-semibold tracking-widest text-cyan-400 uppercase">
              {analysisMode === "quick" ? "Quick Scan" : "Forensic Analysis"}
            </span>
            {result && (
              <>
                <span className="text-muted-foreground/30">│</span>
                <span
                  className={`font-mono text-xs font-bold ${
                    result.verdict.includes("AUTHENTIC")
                      ? "verdict-authentic"
                      : result.verdict.includes("SUSPICIOUS")
                        ? "verdict-suspicious"
                        : "verdict-synthetic"
                  }`}
                >
                  {result.verdict}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <UploadZone
              onFileSelect={handleNewFile}
              compact
              label="New scan"
            />
          </div>
        </div>
      </div>

      {/* ── Loading state (Immersive Forensic Scan) ──────────────────────────── */}
      {isAnalyzing && (
        <div className="relative flex min-h-[80vh] flex-col items-center justify-center p-4">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-500/5 via-purple-500/3 via-background to-background pointer-events-none" />

          <div className="relative z-10 w-full max-w-4xl">
            {/* Neural Network Visualization */}
            <div className="mb-6 h-48 w-full rounded-xl overflow-hidden glass-panel p-1">
              <NeuralNetworkViz
                activeLayer={activeLayerIndex}
                className="h-full"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Scanning card */}
              <div className="glass-panel rounded-2xl p-8 shadow-[0_0_50px_rgba(0,200,255,0.05)] overflow-hidden">
                {/* Scanning Laser Effect */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 shadow-[0_0_20px_rgba(0,200,255,1)] z-20 animate-[scan-line_2s_ease-in-out_infinite]" />

                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />
                    <div className="relative bg-background border border-cyan-500/30 p-4 rounded-full"
                      style={{ boxShadow: "0 0 30px hsla(189, 100%, 50%, 0.2)" }}
                    >
                      <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                    </div>
                  </div>

                  <h3 className="font-display text-lg font-bold text-foreground mb-1 tracking-wider">
                    {analysisMode === "quick" ? "QUICK SCAN" : "FORENSIC AUDIT"}
                  </h3>

                  <div className="h-6 flex items-center justify-center mt-2 mb-6">
                    <span className="font-mono text-sm bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                      {analysisStep || "Initializing pipeline..."}
                    </span>
                  </div>

                  <div className="w-full space-y-2 mt-4">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50">
                      <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 animate-[scan-line_1.5s_linear_infinite]" />
                    </div>
                    <div className="flex justify-between font-mono text-[10px] text-muted-foreground opacity-70">
                      <span>
                        {analysisMode === "quick" ? "3-LAYER SCAN" : "7-LAYER PIPELINE"}
                      </span>
                      <span className="animate-pulse text-cyan-400">RUNNING...</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Radar filling up during analysis */}
              <div className="glass-panel rounded-2xl p-6 flex items-center justify-center">
                <AnalysisRadar
                  scores={
                    isAnalyzing
                      ? {
                          biological: activeLayerIndex >= 0 ? 50 + Math.random() * 30 : 0,
                          integrity: activeLayerIndex >= 1 ? 50 + Math.random() * 30 : 0,
                          environment: activeLayerIndex >= 2 ? 50 + Math.random() * 30 : 0,
                          temporal: activeLayerIndex >= 3 ? 50 + Math.random() * 30 : 0,
                          deepfake: activeLayerIndex >= 4 ? 50 + Math.random() * 30 : 0,
                          fraud: activeLayerIndex >= 5 ? 50 + Math.random() * 30 : 0,
                        }
                      : {}
                  }
                  animated={false}
                  size={240}
                />
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
                <span className="text-cyan-400">
                  uvicorn main:app --port 8001
                </span>
              </p>
              <p>
                · .env set? →{" "}
                <span className="text-cyan-400">
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
        <div className="relative mx-auto max-w-7xl px-4 py-6 z-10">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left sidebar — File Info + Radar */}
            <div className="lg:col-span-3 space-y-4">
              <FileInfoPanel
                fileInfo={result.fileInfo}
                isAnalyzing={isAnalyzing}
              />
              {/* Analysis Radar */}
              <div className="forensic-card flex justify-center py-4">
                <AnalysisRadar
                  scores={radarScores}
                  animated={true}
                  size={200}
                />
              </div>
            </div>

            {/* Main content */}
            <div className="space-y-4 lg:col-span-6">
              {/* Trust Stack — layers */}
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

              {analysisMode === "full" && (
                <FraudAnalysisPanel
                  fraudSummary={activeFraudSummary}
                  analysisId={result.fileInfo?.sha256 ?? ""}
                  onManualTranscript={handleManualTranscript}
                />
              )}

              {/* Spectrogram (interactive) */}
              {result.spectrogramB64 && (
                <div className="forensic-card">
                  <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    Interactive Spectrogram
                  </h3>
                  <SpectrogramHeatmap
                    spectrogramB64={result.spectrogramB64}
                    anomalyMarkers={(result.anomalies ?? []).map(a => ({
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
                  />
                </div>
              )}

              {/* Real waveform */}
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
              />

              {/* Frequency bands bar chart */}
              {result.frequencyBands && (
                <div className="forensic-card">
                  <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    Frequency Band Analysis
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(result.frequencyBands).map(
                      ([band, energy]) => (
                        <div key={band} className="flex items-center gap-3">
                          <span className="w-24 font-mono text-xs text-muted-foreground capitalize">
                            {band.replace(/_/g, " ")}
                          </span>
                          <div className="h-2.5 flex-1 rounded-full bg-secondary/50 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 score-bar-fill"
                              style={{
                                width: `${Math.round((energy as number) * 100)}%`,
                                boxShadow: "0 0 8px hsla(189, 100%, 50%, 0.3)",
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
    </MouseGlowEffect>
  );
}
