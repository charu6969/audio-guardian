import { useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { Loader2, ArrowLeftRight } from "lucide-react";
import { compareAudio, type CompareResult } from "@/lib/audioNotaryApi";

export default function Compare() {
  const [refFile, setRefFile] = useState<File | null>(null);
  const [disputedFile, setDisputedFile] = useState<File | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async (ref: File, disputed: File) => {
    setIsComparing(true);
    setError(null);
    setCompareResult(null);
    try {
      const result = await compareAudio(ref, disputed);
      setCompareResult(result);
    } catch (err: any) {
      setError(err.message || "Comparison failed");
    } finally {
      setIsComparing(false);
    }
  };

  const handleRefSelect = (f: File) => {
    setRefFile(f);
    setCompareResult(null);
    if (disputedFile) handleCompare(f, disputedFile);
  };

  const handleDisputedSelect = (f: File) => {
    setDisputedFile(f);
    setCompareResult(null);
    if (refFile) handleCompare(refFile, f);
  };

  // Verdict color from real API risk level
  const verdictColor =
    compareResult?.risk_level === "HIGH"
      ? "text-destructive"
      : compareResult?.risk_level === "MEDIUM"
        ? "text-warning"
        : "text-accent";

  // ML layer sub-metric detail from disputed file analysis
  const mlDetail =
    compareResult?.disputed_file_ml_analysis?.sub_metrics?.deepfake_classifier
      ?.detail;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-foreground">
          Voice Clone Detection
        </h1>
        <p className="text-sm text-muted-foreground">
          Compare a reference audio (known authentic) against a disputed audio
          to detect synthetic cloning.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Reference */}
        <div className="forensic-card">
          <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-accent">
            Reference Audio (Known Authentic)
          </h3>
          {refFile ? (
            <div className="space-y-2">
              <p className="font-mono text-sm text-foreground">
                {refFile.name}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {(refFile.size / 1024).toFixed(1)} KB · Loaded ✓
              </p>
            </div>
          ) : (
            <UploadZone
              compact
              label="Drop reference audio"
              onFileSelect={handleRefSelect}
            />
          )}
        </div>

        {/* Disputed */}
        <div className="forensic-card">
          <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-destructive">
            Disputed Audio (Under Investigation)
          </h3>
          {disputedFile ? (
            <div className="space-y-2">
              <p className="font-mono text-sm text-foreground">
                {disputedFile.name}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {(disputedFile.size / 1024).toFixed(1)} KB · Loaded ✓
              </p>
            </div>
          ) : (
            <UploadZone
              compact
              label="Drop disputed audio"
              onFileSelect={handleDisputedSelect}
            />
          )}
        </div>
      </div>

      {/* Loading state */}
      {isComparing && (
        <div className="mt-8 forensic-card flex items-center justify-center gap-3 py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="font-mono text-sm text-primary">
            Running voice fingerprint comparison...
          </span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-8 forensic-card border-l-4 border-l-destructive">
          <p className="font-mono text-sm text-destructive">⚠ {error}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Make sure the backend is running on port 8001 and both files are
            valid audio.
          </p>
        </div>
      )}

      {/* Real comparison result */}
      {compareResult && !isComparing && (
        <div className="mt-8 animate-fade-slide-in space-y-4">
          {/* Main similarity score */}
          <div className="forensic-card text-center">
            <ArrowLeftRight className="mx-auto mb-3 h-8 w-8 text-primary" />
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Voice Print Similarity
            </p>
            <p className="mb-2 font-mono text-5xl font-bold text-foreground">
              {compareResult.voice_similarity_score}%
            </p>
            <p className={`font-mono text-sm font-bold ${verdictColor}`}>
              {compareResult.clone_verdict}
            </p>

            {/* Risk badge */}
            <span
              className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 font-mono text-xs font-semibold
                ${
                  compareResult.risk_level === "HIGH"
                    ? "border-destructive text-destructive"
                    : compareResult.risk_level === "MEDIUM"
                      ? "border-warning text-warning"
                      : "border-accent text-accent"
                }`}
            >
              Risk Level: {compareResult.risk_level}
            </span>
          </div>

          {/* ML classifier result on disputed file */}
          {compareResult.disputed_file_ml_analysis && (
            <div className="forensic-card border-l-4 border-l-primary">
              <h4 className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-primary">
                🤖 ML Deepfake Classifier — Disputed File
              </h4>
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-mono text-2xl font-bold text-foreground">
                    {compareResult.disputed_file_ml_analysis.score}
                    <span className="text-sm text-muted-foreground">/100</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Authenticity Score
                  </p>
                </div>
                <div className="flex-1">
                  <div className="h-2 w-full rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        compareResult.disputed_file_ml_analysis.score >= 70
                          ? "bg-accent"
                          : compareResult.disputed_file_ml_analysis.score >= 45
                            ? "bg-warning"
                            : "bg-destructive"
                      }`}
                      style={{
                        width: `${compareResult.disputed_file_ml_analysis.score}%`,
                      }}
                    />
                  </div>
                  {mlDetail && (
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {mlDetail}
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs font-semibold
                    ${
                      compareResult.disputed_file_ml_analysis.status === "PASS"
                        ? "status-pass"
                        : compareResult.disputed_file_ml_analysis.status ===
                            "FAIL"
                          ? "status-fail"
                          : "status-warning"
                    }`}
                >
                  {compareResult.disputed_file_ml_analysis.status}
                </span>
              </div>
            </div>
          )}

          {/* Reset button */}
          <div className="text-center">
            <button
              onClick={() => {
                setRefFile(null);
                setDisputedFile(null);
                setCompareResult(null);
                setError(null);
              }}
              className="rounded border border-border px-4 py-2 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Run New Comparison
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
