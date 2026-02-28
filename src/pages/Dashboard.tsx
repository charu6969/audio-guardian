import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAnalysis } from "@/hooks/useAnalysis";
import { FileInfoPanel } from "@/components/FileInfoPanel";
import { TrustLayerCard } from "@/components/TrustLayerCard";
import { WaveformViewer } from "@/components/WaveformViewer";
import { VerdictCard } from "@/components/VerdictCard";
import { ForensicReport } from "@/components/ForensicReport";
import { UploadZone } from "@/components/UploadZone";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAnalyzing, analysisStep, result, demoMode, analyze, toggleDemoMode } = useAnalysis();
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    const file = (location.state as { file?: File })?.file;
    if (file) {
      analyze(file);
    }
  }, []);

  const handleNewFile = (file: File) => {
    analyze(file);
  };

  if (!result && !isAnalyzing) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="w-full max-w-md">
          <h2 className="mb-4 text-center text-xl font-bold text-foreground">Upload Audio for Analysis</h2>
          <UploadZone onFileSelect={handleNewFile} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* Top bar with demo toggle */}
      {(result || isAnalyzing) && (
        <div className="border-b border-border bg-card/50 px-4 py-2">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground">Demo Mode:</span>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-xs ${demoMode === "authentic" ? "text-accent" : "text-muted-foreground"}`}>
                  Authentic
                </span>
                <Switch
                  checked={demoMode === "synthetic"}
                  onCheckedChange={toggleDemoMode}
                  className="data-[state=checked]:bg-destructive"
                />
                <span className={`font-mono text-xs ${demoMode === "synthetic" ? "text-destructive" : "text-muted-foreground"}`}>
                  Synthetic
                </span>
              </div>
            </div>
            <UploadZone onFileSelect={handleNewFile} compact label="Upload new file" />
          </div>
        </div>
      )}

      {/* Loading state */}
      {isAnalyzing && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="text-center">
            <p className="font-mono text-sm text-primary">{analysisStep}</p>
            <div className="mx-auto mt-3 h-1 w-48 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-1/3 rounded-full bg-primary scan-line" />
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !isAnalyzing && (
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left sidebar - File Info */}
            <div className="lg:col-span-3">
              <FileInfoPanel fileInfo={result.fileInfo} isAnalyzing={isAnalyzing} />
            </div>

            {/* Main content */}
            <div className="space-y-4 lg:col-span-6">
              {/* Trust Stack */}
              <div className="space-y-3">
                {result.layers.map((layer, i) => (
                  <TrustLayerCard key={layer.id} layer={layer} delay={i * 500} />
                ))}
              </div>

              {/* Waveform */}
              <WaveformViewer anomalies={result.anomalies} duration={result.fileInfo.duration} />
            </div>

            {/* Right panel - Verdict */}
            <div className="lg:col-span-3">
              <div className="sticky top-20">
                <VerdictCard result={result} onGenerateReport={() => setShowReport(true)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report modal */}
      {showReport && result && (
        <ForensicReport result={result} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
