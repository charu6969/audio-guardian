import type { AnalysisResult } from "@/hooks/useAnalysis";
import { Shield, X, Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ForensicReportProps {
  result: AnalysisResult;
  onClose: () => void;
}

export function ForensicReport({ result, onClose }: ForensicReportProps) {
  const verdictText =
    result.verdict === "AUTHENTIC"
      ? "The submitted audio sample demonstrates high consistency across all forensic analysis layers. Biological voice signatures, digital integrity markers, and temporal coherence patterns are within expected parameters for authentic human speech."
      : result.verdict === "SUSPICIOUS"
      ? "The submitted audio sample exhibits several irregularities across forensic analysis layers. While some biological markers appear consistent, digital integrity and temporal coherence anomalies warrant further investigation."
      : "The submitted audio sample exhibits significant indicators of synthetic generation. Multiple forensic layers detected anomalies consistent with AI-generated or manipulated audio content.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative mx-4 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-card p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-8 border-b border-border pb-6 text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">
              Audio<span className="text-primary">Notary</span>
            </span>
          </div>
          <h1 className="font-mono text-lg font-bold uppercase tracking-widest text-foreground">
            Forensic Analysis Certificate
          </h1>
          <div className="mt-3 flex flex-wrap justify-center gap-6 font-mono text-xs text-muted-foreground">
            <span>Case ID: {result.caseId}</span>
            <span>Date: {result.fileInfo.uploadTimestamp.toISOString().split("T")[0]}</span>
            <span>Analyzer: v1.0.0</span>
          </div>
        </div>

        {/* Executive Summary */}
        <section className="mb-6">
          <h2 className="mb-2 font-mono text-sm font-bold uppercase tracking-wider text-primary">
            Executive Summary
          </h2>
          <div className="rounded-lg bg-secondary/50 p-4">
            <p className="mb-2 font-mono text-sm font-bold text-foreground">
              Verdict:{" "}
              <span
                className={
                  result.verdict === "AUTHENTIC"
                    ? "text-accent"
                    : result.verdict === "SUSPICIOUS"
                    ? "text-warning"
                    : "text-destructive"
                }
              >
                {result.verdict}
              </span>{" "}
              — Overall Trust Score: {result.overallScore}/100
            </p>
            <p className="text-sm text-muted-foreground">{verdictText}</p>
          </div>
        </section>

        {/* Chain of Custody */}
        <section className="mb-6">
          <h2 className="mb-2 font-mono text-sm font-bold uppercase tracking-wider text-primary">
            File Chain of Custody
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-border">
                {[
                  ["Filename", result.fileInfo.name],
                  ["Format", result.fileInfo.format],
                  ["Size", `${(result.fileInfo.size / 1048576).toFixed(2)} MB`],
                  ["Duration", `${result.fileInfo.duration}s`],
                  ["Sample Rate", `${result.fileInfo.sampleRate.toLocaleString()} Hz`],
                  ["Upload Time", result.fileInfo.uploadTimestamp.toISOString()],
                  ["SHA-256", result.fileInfo.sha256],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="py-2 pr-4 font-medium text-muted-foreground">{k}</td>
                    <td className="py-2 font-mono text-xs text-foreground">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Layer-by-Layer Findings */}
        <section className="mb-6">
          <h2 className="mb-2 font-mono text-sm font-bold uppercase tracking-wider text-primary">
            Layer-by-Layer Findings
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-2">Layer</th>
                  <th className="pb-2">Score</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Finding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.layers.map((layer) => (
                  <tr key={layer.id}>
                    <td className="py-2 font-medium text-foreground">
                      {layer.icon} {layer.name}
                    </td>
                    <td className="py-2 font-mono text-foreground">{layer.score}/100</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          layer.status === "PASS"
                            ? "status-pass"
                            : layer.status === "FAIL"
                            ? "status-fail"
                            : "status-warning"
                        }`}
                      >
                        {layer.status}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {layer.status === "PASS"
                        ? "Within expected parameters"
                        : layer.status === "SUSPICIOUS"
                        ? "Anomalies detected, review recommended"
                        : "Significant irregularities found"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Anomaly Timeline */}
        <section className="mb-6">
          <h2 className="mb-2 font-mono text-sm font-bold uppercase tracking-wider text-primary">
            Anomaly Timeline
          </h2>
          <div className="space-y-2">
            {result.anomalies.map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded bg-secondary/50 px-3 py-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    a.severity === "suspicious"
                      ? "bg-destructive"
                      : a.severity === "warning"
                      ? "bg-warning"
                      : "bg-accent"
                  }`}
                />
                <span className="font-mono text-xs text-muted-foreground">{a.timestamp.toFixed(1)}s</span>
                <span className="text-sm text-foreground">{a.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Certification */}
        <section className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
          <p className="font-mono text-xs text-muted-foreground">
            This analysis was performed by AudioNotary v1.0. SHA-256 integrity hash locked at time of
            analysis. This document constitutes a forensic analysis certificate and should be treated as
            supporting evidence only.
          </p>
        </section>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => toast.success("PDF generation simulated")}
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2 border-border text-foreground hover:bg-secondary"
            onClick={() => {
              navigator.clipboard.writeText(`https://audionotary.app/report/${result.caseId}`);
              toast.success("Link copied to clipboard");
            }}
          >
            <Copy className="h-4 w-4" />
            Copy Shareable Link
          </Button>
        </div>
      </div>
    </div>
  );
}
