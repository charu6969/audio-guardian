import { useState } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Mic,
  MicOff,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface FlaggedSegment {
  text: string;
  timestamp_sec: number | null;
  category: string;
  category_label: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
}

interface FraudSummary {
  threat_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "UNKNOWN";
  fraud_intent_score: number;
  sensitive_data_requested: boolean;
  authority_impersonation: boolean;
  urgency_level: string;
  recommended_action: string;
  plain_english_summary: string;
  flagged_segments: FlaggedSegment[];
  transcript: string;
  asr_available: boolean;
}

interface Props {
  fraudSummary: FraudSummary | null;
  analysisId: string; // file hash or analysis session id
  onManualTranscript: (transcript: string) => void;
  loading?: boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#fbbf24",
  LOW: "#a3e635",
};

const THREAT_CONFIG = {
  CRITICAL: {
    color: "#ef4444",
    bg: "#1f0707",
    icon: ShieldAlert,
    label: "FRAUD ATTEMPT DETECTED",
  },
  HIGH: {
    color: "#f97316",
    bg: "#1c0f04",
    icon: ShieldAlert,
    label: "HIGH FRAUD RISK",
  },
  MODERATE: {
    color: "#fbbf24",
    bg: "#1c1604",
    icon: AlertTriangle,
    label: "SUSPICIOUS",
  },
  LOW: {
    color: "#00ff88",
    bg: "#041c0e",
    icon: ShieldCheck,
    label: "LOW RISK",
  },
  UNKNOWN: {
    color: "#94a3b8",
    bg: "#111827",
    icon: ShieldQuestion,
    label: "UNABLE TO ASSESS",
  },
};

export default function FraudAnalysisPanel({
  fraudSummary,
  analysisId,
  onManualTranscript,
  loading,
}: Props) {
  const [manualText, setManualText] = useState("");
  const [showFlags, setShowFlags] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const asrMissing = fraudSummary && !fraudSummary.asr_available;
  const threatLevel = fraudSummary?.threat_level ?? "UNKNOWN";
  const cfg = THREAT_CONFIG[threatLevel] || THREAT_CONFIG.UNKNOWN;
  const ThreatIcon = cfg.icon;

  const handleManualSubmit = async () => {
    if (!manualText.trim()) return;
    setSubmitting(true);
    try {
      await onManualTranscript(manualText.trim());
    } finally {
      setSubmitting(false);
    }
  };

  // ── Not yet analyzed ──────────────────────────────────────────────────────
  if (!fraudSummary && !loading) return null;

  return (
    <div
      style={{
        background: "#0d1117",
        border: "1px solid #1e293b",
        borderRadius: 12,
        padding: 24,
        marginTop: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <ShieldAlert size={22} color="#00aacc" />
        <span style={{ fontWeight: 700, fontSize: 16, color: "#e2e8f0" }}>
          Social Engineering Analysis
        </span>
        {fraudSummary?.asr_available ? (
          <span
            style={{
              marginLeft: "auto",
              background: "#042f1c",
              color: "#00ff88",
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Mic size={11} /> ASR Active
          </span>
        ) : (
          <span
            style={{
              marginLeft: "auto",
              background: "#1c0f04",
              color: "#f97316",
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <MicOff size={11} /> ASR Offline
          </span>
        )}
      </div>

      {/* ── ASR offline warning + manual input ─────────────────────────────── */}
      {asrMissing && (
        <div
          style={{
            background: "#1c1604",
            border: "1px solid #f97316",
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              color: "#fbbf24",
              fontWeight: 600,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <AlertTriangle size={15} /> Whisper ASR not installed — speech
            analysis disabled
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 12 }}>
            To enable automatic transcription, run in your backend terminal:
          </div>
          <code
            style={{
              display: "block",
              background: "#0f172a",
              color: "#00ff88",
              padding: "8px 12px",
              borderRadius: 6,
              fontSize: 13,
              marginBottom: 14,
            }}
          >
            pip install openai-whisper
          </code>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>
            Or paste the transcript manually to scan now:
          </div>
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder='Paste transcript here — e.g. "This is calling from RBI. Please share your OTP for KYC verification immediately..."'
            style={{
              width: "100%",
              minHeight: 90,
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 6,
              color: "#e2e8f0",
              fontSize: 13,
              padding: 10,
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleManualSubmit}
            disabled={!manualText.trim() || submitting}
            style={{
              marginTop: 10,
              background: !manualText.trim() ? "#1e293b" : "#0066aa",
              color: !manualText.trim() ? "#475569" : "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 20px",
              cursor: !manualText.trim() ? "default" : "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {submitting ? "Scanning..." : "Scan Transcript"}
          </button>
        </div>
      )}

      {/* ── Threat verdict card ─────────────────────────────────────────────── */}
      {fraudSummary && threatLevel !== "UNKNOWN" && (
        <>
          <div
            style={{
              background: cfg.bg,
              border: `1px solid ${cfg.color}`,
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <ThreatIcon size={32} color={cfg.color} />
            <div>
              <div
                style={{
                  color: cfg.color,
                  fontWeight: 800,
                  fontSize: 20,
                  letterSpacing: 1,
                }}
              >
                {cfg.label}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 3 }}>
                Fraud Intent Score:{" "}
                <span style={{ color: cfg.color, fontWeight: 700 }}>
                  {fraudSummary.fraud_intent_score}/100
                </span>
              </div>
            </div>
          </div>

          {/* ── Quick indicators row ─────────────────────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 10,
              marginBottom: 16,
            }}
          >
            {[
              {
                label: "Sensitive Data Request",
                value: fraudSummary.sensitive_data_requested,
                trueColor: "#ef4444",
                falseColor: "#00ff88",
                trueText: "DETECTED",
                falseText: "Clean",
              },
              {
                label: "Authority Impersonation",
                value: fraudSummary.authority_impersonation,
                trueColor: "#ef4444",
                falseColor: "#00ff88",
                trueText: "DETECTED",
                falseText: "Clean",
              },
              {
                label: "Urgency Pressure",
                value: fraudSummary.urgency_level,
                trueColor:
                  fraudSummary.urgency_level === "High" ? "#ef4444" : "#fbbf24",
                falseColor: "#00ff88",
                trueText: fraudSummary.urgency_level,
                falseText: "None",
              },
            ].map(
              ({
                label,
                value,
                trueColor,
                falseColor,
                trueText,
                falseText,
              }) => {
                const isAlert =
                  value === true ||
                  (typeof value === "string" &&
                    value !== "None" &&
                    value !== "Unknown");
                return (
                  <div
                    key={label}
                    style={{
                      background: "#111827",
                      border: `1px solid ${isAlert ? trueColor : "#1e293b"}`,
                      borderRadius: 8,
                      padding: "10px 14px",
                    }}
                  >
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: 11,
                        marginBottom: 4,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        color: isAlert ? trueColor : falseColor,
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {isAlert ? trueText : falseText}
                    </div>
                  </div>
                );
              },
            )}
          </div>

          {/* ── Plain English summary ─────────────────────────────────────────── */}
          <div
            style={{
              background: "#111827",
              borderRadius: 8,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>
              {fraudSummary.plain_english_summary}
            </div>
          </div>

          {/* ── Recommended action ───────────────────────────────────────────── */}
          {fraudSummary.recommended_action && (
            <div
              style={{
                background: "#0a0f1e",
                border: `1px solid ${cfg.color}33`,
                borderRadius: 8,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <span style={{ color: "#64748b", fontSize: 12 }}>
                RECOMMENDED ACTION{" "}
              </span>
              <span style={{ color: cfg.color, fontSize: 13, fontWeight: 600 }}>
                {fraudSummary.recommended_action}
              </span>
            </div>
          )}

          {/* ── Flagged segments ─────────────────────────────────────────────── */}
          {fraudSummary.flagged_segments?.length > 0 && (
            <div>
              <button
                onClick={() => setShowFlags((f) => !f)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: 0,
                  marginBottom: 10,
                }}
              >
                {showFlags ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
                {fraudSummary.flagged_segments.length} Flagged Segment
                {fraudSummary.flagged_segments.length > 1 ? "s" : ""}
              </button>

              {showFlags &&
                fraudSummary.flagged_segments.map((seg, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#0d1117",
                      borderLeft: `3px solid ${SEVERITY_COLOR[seg.severity]}`,
                      borderRadius: "0 8px 8px 0",
                      padding: "10px 14px",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          color: SEVERITY_COLOR[seg.severity],
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {seg.severity} · {seg.category_label}
                      </span>
                      {seg.timestamp_sec !== null && (
                        <span style={{ color: "#475569", fontSize: 11 }}>
                          ⏱ {seg.timestamp_sec}s
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        color: "#e2e8f0",
                        fontSize: 13,
                        marginBottom: 4,
                        fontStyle: "italic",
                      }}
                    >
                      "{seg.text}"
                    </div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>
                      {seg.explanation}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* ── Transcript display ───────────────────────────────────────────── */}
          {fraudSummary.transcript && (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: "#475569", fontSize: 11, marginBottom: 6 }}>
                TRANSCRIPT
              </div>
              <div
                style={{
                  background: "#111827",
                  borderRadius: 8,
                  padding: 12,
                  color: "#64748b",
                  fontSize: 12,
                  fontStyle: "italic",
                  lineHeight: 1.6,
                }}
              >
                "{fraudSummary.transcript}"
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
