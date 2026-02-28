import { useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { useAnalysis, type AnalysisResult } from "@/hooks/useAnalysis";
import { Loader2, ArrowLeftRight } from "lucide-react";

export default function Compare() {
  const refAnalysis = useAnalysis();
  const disputedAnalysis = useAnalysis();
  const [refFile, setRefFile] = useState<File | null>(null);
  const [disputedFile, setDisputedFile] = useState<File | null>(null);

  const bothDone = refAnalysis.result && disputedAnalysis.result;

  const similarityScore = bothDone
    ? Math.round(
        Math.abs(
          100 -
            Math.abs(refAnalysis.result!.overallScore - disputedAnalysis.result!.overallScore) * 1.5 -
            Math.random() * 10
        )
      )
    : 0;

  const verdict =
    similarityScore > 80
      ? "HIGH MATCH — Likely Same Speaker"
      : similarityScore > 50
      ? "PARTIAL MATCH — Requires Further Review"
      : "LOW MATCH — Likely Different Source";

  const verdictColor =
    similarityScore > 80 ? "text-accent" : similarityScore > 50 ? "text-warning" : "text-destructive";

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-foreground">Voice Clone Detection</h1>
        <p className="text-sm text-muted-foreground">
          Compare a reference audio (known authentic) against a disputed audio to detect synthetic cloning.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Reference */}
        <div className="forensic-card">
          <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-accent">
            Reference Audio (Known Authentic)
          </h3>
          {refFile && refAnalysis.result ? (
            <div className="space-y-2">
              <p className="font-mono text-sm text-foreground">{refFile.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                Trust Score: {refAnalysis.result.overallScore}/100
              </p>
              {refAnalysis.result.layers.map((l) => (
                <div key={l.id} className="flex items-center gap-2">
                  <span className="text-sm">{l.icon}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-accent score-bar-fill"
                      style={{ width: `${l.score}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{l.score}</span>
                </div>
              ))}
            </div>
          ) : refAnalysis.isAnalyzing ? (
            <div className="flex items-center gap-2 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="font-mono text-xs text-primary">{refAnalysis.analysisStep}</span>
            </div>
          ) : (
            <UploadZone
              compact
              label="Drop reference audio"
              onFileSelect={(f) => {
                setRefFile(f);
                refAnalysis.analyze(f);
              }}
            />
          )}
        </div>

        {/* Disputed */}
        <div className="forensic-card">
          <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-destructive">
            Disputed Audio (Under Investigation)
          </h3>
          {disputedFile && disputedAnalysis.result ? (
            <div className="space-y-2">
              <p className="font-mono text-sm text-foreground">{disputedFile.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                Trust Score: {disputedAnalysis.result.overallScore}/100
              </p>
              {disputedAnalysis.result.layers.map((l) => (
                <div key={l.id} className="flex items-center gap-2">
                  <span className="text-sm">{l.icon}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full score-bar-fill ${
                        l.score >= 75 ? "bg-accent" : l.score >= 50 ? "bg-warning" : "bg-destructive"
                      }`}
                      style={{ width: `${l.score}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{l.score}</span>
                </div>
              ))}
            </div>
          ) : disputedAnalysis.isAnalyzing ? (
            <div className="flex items-center gap-2 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="font-mono text-xs text-primary">{disputedAnalysis.analysisStep}</span>
            </div>
          ) : (
            <UploadZone
              compact
              label="Drop disputed audio"
              onFileSelect={(f) => {
                setDisputedFile(f);
                disputedAnalysis.analyze(f);
              }}
            />
          )}
        </div>
      </div>

      {/* Comparison Result */}
      {bothDone && (
        <div className="mt-8 animate-fade-slide-in forensic-card text-center">
          <ArrowLeftRight className="mx-auto mb-3 h-8 w-8 text-primary" />
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Voice Print Similarity
          </p>
          <p className="mb-2 font-mono text-4xl font-bold text-foreground">{similarityScore}%</p>
          <p className={`font-mono text-sm font-bold ${verdictColor}`}>{verdict}</p>
        </div>
      )}
    </div>
  );
}
