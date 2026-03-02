import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAnalysis } from "@/hooks/useAnalysis";
import { FileInfoPanel } from "@/components/FileInfoPanel";
import { TrustLayerCard } from "@/components/TrustLayerCard";
import { WaveformViewer } from "@/components/WaveformViewer";
import { VerdictCard } from "@/components/VerdictCard";
import { UploadZone } from "@/components/UploadZone";
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

  // Auto-start analysis when navigated here with a file
  useEffect(() => {
    const state = location.state as { file?: File } | null;
    if (state?.file) {
      analyze(state.file);
    }
  }, []);

  const handleNewFile = (file: File) => {
    resetAnalysis();
    analyze(file);
  };

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!result && !isAnalyzing && !error) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="w-full max-w-md">
          <h2 className="mb-4 text-center text-xl font-bold text-foreground">
            Upload Audio for Analysis
          </h2>
          <UploadZone onFileSelect={handleNewFile} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* Top bar */}
      <div className="border-b border-border bg-card/50 px-4 py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              AudioNotary — Forensic Analysis
            </span>
            {result && (
              <span
                className={`font-mono text-xs font-bold ${
                  result.verdict.includes("AUTHENTIC")
                    ? "text-accent"
                    : result.verdict.includes("SUSPICIOUS")
                      ? "text-warning"
                      : "text-destructive"
                }`}
              >
                · {result.verdict}
              </span>
            )}
          </div>
          <UploadZone
            onFileSelect={handleNewFile}
            compact
            label="Upload new file"
          />
        </div>
      </div>

      {/* ── Loading state ──────────────────────────────────────────────────── */}
      {isAnalyzing && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="text-center">
            <p className="font-mono text-sm text-primary">{analysisStep}</p>
            <div className="mx-auto mt-3 h-1 w-48 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-1/3 rounded-full bg-primary scan-line" />
            </div>
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              Running 6-layer forensic trust audit...
            </p>
          </div>
        </div>
      )}

      {/* ── Error state ────────────────────────────────────────────────────── */}
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

      {/* ── Results ────────────────────────────────────────────────────────── */}
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
              {/* Trust Stack — 6 real layers */}
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

              {/* Real waveform + spectrogram */}
              <WaveformViewer
                waveformEnvelope={result.waveformEnvelope ?? []}
                anomalyMarkers={
                  // map back to AnomalyMarker shape WaveformViewer expects
                  (result.anomalies ?? []).map((a) => ({
                    time_sec: a.timestamp,
                    label: a.label,
                    severity:
                      a.severity === "suspicious"
                        ? "high"
                        : a.severity === "warning"
                          ? "medium"
                          : "low",
                  }))
                }
                duration={result.fileInfo.duration}
                spectrogramB64={result.spectrogramB64}
              />

              {/* Frequency bands bar chart (bonus visual) */}
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
                              style={{ width: `${Math.round(energy * 100)}%` }}
                            />
                          </div>
                          <span className="w-10 font-mono text-xs text-muted-foreground text-right">
                            {Math.round(energy * 100)}%
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
