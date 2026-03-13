import { Shield, Zap } from "lucide-react";

interface AnalysisModeSelectorProps {
  mode: "quick" | "full";
  onModeChange: (mode: "quick" | "full") => void;
  className?: string;
}

export function AnalysisModeSelector({ mode, onModeChange, className = "" }: AnalysisModeSelectorProps) {
  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`}>
      {/* Quick Mode */}
      <button
        onClick={() => onModeChange("quick")}
        className={`relative group forensic-card text-left transition-all duration-300 ${
          mode === "quick"
            ? "neon-border ring-1 ring-purple-400/30"
            : "hover:border-purple-500/20"
        }`}
      >
        {mode === "quick" && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500/5 to-violet-500/3 pointer-events-none" />
        )}
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/10">
              <Zap className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold text-foreground">
                Quick Analyzer
              </h3>
              <span className="font-mono text-[10px] text-purple-400">Real-time (&lt; 1s)</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Fast human-centric latency-optimized scan: Biological Signature, Temporal Coherence, Environmental Consistency
          </p>
          <div className="space-y-1">
            {["Biological Signature", "Temporal Coherence", "Environmental Consistency"].map(layer => (
              <div key={layer} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span className="font-mono text-[10px] text-muted-foreground">{layer}</span>
              </div>
            ))}
          </div>
        </div>
      </button>

      {/* Full Mode */}
      <button
        onClick={() => onModeChange("full")}
        className={`relative group forensic-card text-left transition-all duration-300 ${
          mode === "full"
            ? "neon-border ring-1 ring-purple-400/30"
            : "hover:border-purple-500/20"
        }`}
      >
        {mode === "full" && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500/5 to-violet-500/3 pointer-events-none" />
        )}
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/10">
              <Shield className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold text-foreground">
                Full Forensic
              </h3>
              <span className="font-mono text-[10px] text-purple-400">7-layer deep scan</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Complete forensic audit with all analysis layers + fraud detection
          </p>
          <div className="space-y-1">
            {[
              "Biological Signature",
              "Digital Integrity",
              "Environmental Consistency",
              "Temporal Coherence",
              "Cross-Modal Fingerprint",
              "ML Deepfake Classifier",
              "Social Engineering",
            ].map(layer => (
              <div key={layer} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span className="font-mono text-[10px] text-muted-foreground">{layer}</span>
              </div>
            ))}
          </div>
        </div>
      </button>
    </div>
  );
}
