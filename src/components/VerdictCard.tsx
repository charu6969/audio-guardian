import { useEffect, useRef, useState } from "react";
import type { AnalysisResult } from "@/hooks/useAnalysis";
import { TrustScoreGauge } from "@/components/TrustScoreGauge";
import { RiskPulseIndicator } from "@/components/RiskPulseIndicator";
import { Button } from "@/components/ui/button";
import { FileText, Link2 } from "lucide-react";

interface VerdictCardProps {
  result: AnalysisResult;
  onGenerateReport: () => void;
}

export function VerdictCard({ result, onGenerateReport }: VerdictCardProps) {
  const verdictClass =
    result.verdict.includes("AUTHENTIC")
      ? "verdict-authentic"
      : result.verdict.includes("SUSPICIOUS")
        ? "verdict-suspicious"
        : "verdict-synthetic";

  // Determine risk severity for pulse indicator
  const riskSeverity: "clean" | "low" | "moderate" | "high" | "critical" =
    result.overallScore >= 78
      ? "clean"
      : result.overallScore >= 62
        ? "low"
        : result.overallScore >= 45
          ? "moderate"
          : result.overallScore >= 28
            ? "high"
            : "critical";

  return (
    <div className="forensic-card space-y-5">
      {/* Verdict text */}
      <div className="text-center">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
          Final Verdict
        </p>
        <h2 className={`pulse-once font-display text-xl font-bold tracking-wider ${verdictClass}`}>
          {result.verdict}
        </h2>
      </div>

      {/* Trust Score Gauge */}
      <div className="flex justify-center -mt-1">
        <TrustScoreGauge
          score={result.overallScore}
          authenticityScore={result.authenticityScore}
          fraudRiskScore={result.fraudRiskScore}
          size={200}
        />
      </div>

      {/* Risk Pulse */}
      {riskSeverity !== "clean" && riskSeverity !== "low" && (
        <div className="flex justify-center">
          <RiskPulseIndicator severity={riskSeverity} />
        </div>
      )}

      {/* Confidence breakdown */}
      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
          Layer Confidence
        </p>
        {result.layers.map((layer) => {
          const barColor =
            layer.score >= 75
              ? "from-green-400 to-emerald-500"
              : layer.score >= 50
                ? "from-yellow-400 to-amber-500"
                : "from-red-400 to-rose-500";
          const glowColor =
            layer.score >= 75
              ? "hsla(155, 100%, 50%, 0.3)"
              : layer.score >= 50
                ? "hsla(43, 96%, 56%, 0.3)"
                : "hsla(0, 84%, 60%, 0.3)";

          return (
            <div key={layer.id} className="flex items-center gap-2">
              <span className="text-sm">{layer.icon}</span>
              <div className="flex-1">
                <div className="h-1.5 w-full rounded-full bg-secondary/50 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${barColor} score-bar-fill`}
                    style={{
                      width: `${layer.score}%`,
                      boxShadow: `0 0 6px ${glowColor}`,
                    }}
                  />
                </div>
              </div>
              <span className="font-mono text-xs text-muted-foreground w-6 text-right">
                {layer.score}
              </span>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button
          className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 font-mono text-xs"
          onClick={onGenerateReport}
          style={{ boxShadow: "0 0 20px hsla(189, 100%, 50%, 0.2)" }}
        >
          <FileText className="h-4 w-4" />
          Generate Forensic Report
        </Button>
        <Button
          variant="outline"
          className="w-full gap-2 border-border/50 text-foreground hover:bg-secondary/50 hover:border-cyan-500/20 font-mono text-xs"
        >
          <Link2 className="h-4 w-4" />
          Compare with Reference
        </Button>
      </div>
    </div>
  );
}
