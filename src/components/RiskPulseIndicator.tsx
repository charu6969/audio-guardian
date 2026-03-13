interface RiskPulseIndicatorProps {
  severity: "clean" | "low" | "moderate" | "high" | "critical";
  label?: string;
  className?: string;
}

const SEVERITY_CONFIG = {
  clean: {
    color: "hsl(155, 100%, 50%)",
    bgColor: "hsl(155, 100%, 50%)",
    label: "CLEAN",
    icon: "✓",
  },
  low: {
    color: "hsl(155, 100%, 50%)",
    bgColor: "hsl(155, 100%, 50%)",
    label: "LOW RISK",
    icon: "✓",
  },
  moderate: {
    color: "hsl(43, 96%, 56%)",
    bgColor: "hsl(43, 96%, 56%)",
    label: "MODERATE",
    icon: "⚠",
  },
  high: {
    color: "hsl(25, 100%, 55%)",
    bgColor: "hsl(25, 100%, 55%)",
    label: "HIGH RISK",
    icon: "⚠",
  },
  critical: {
    color: "hsl(0, 84%, 60%)",
    bgColor: "hsl(0, 84%, 60%)",
    label: "CRITICAL",
    icon: "⛔",
  },
};

export function RiskPulseIndicator({ severity, label, className = "" }: RiskPulseIndicatorProps) {
  const config = SEVERITY_CONFIG[severity];
  const showPulse = severity === "high" || severity === "critical";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative">
        {/* Pulse rings */}
        {showPulse && (
          <>
            <div
              className="absolute inset-0 rounded-full animate-risk-pulse"
              style={{
                background: `${config.bgColor}20`,
                boxShadow: `0 0 0 0 ${config.bgColor}70`,
              }}
            />
            <div
              className="absolute inset-0 rounded-full animate-risk-pulse"
              style={{
                background: `${config.bgColor}15`,
                animationDelay: "0.5s",
              }}
            />
          </>
        )}

        {/* Core indicator */}
        <div
          className="relative flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
          style={{
            background: `${config.bgColor}20`,
            border: `2px solid ${config.color}`,
            boxShadow: showPulse ? `0 0 15px ${config.color}40` : "none",
            color: config.color,
          }}
        >
          {config.icon}
        </div>
      </div>

      {/* Label */}
      <div>
        <div
          className="font-mono text-xs font-bold uppercase tracking-wider"
          style={{ color: config.color }}
        >
          {label || config.label}
        </div>
      </div>
    </div>
  );
}
