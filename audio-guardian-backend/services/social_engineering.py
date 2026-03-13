"""
Social Engineering Detection Service
=====================================
Priority Layer: Proactive keyword + pattern detection for vishing/fraud calls.

Strategy:
  - NOT simple keyword matching — uses weighted category scoring with context windows
  - Each detected pattern carries a severity weight (CRITICAL / HIGH / MEDIUM / LOW)
  - Overlapping patterns in the same sentence boost the score (compounding signals)
  - Outputs: flagged segments with timestamps, per-category scores, overall Fraud Intent Score

No ML models required — runs instantly on CPU, zero download time.
Can be upgraded to semantic similarity later (Phase 2).
"""

import re
from dataclasses import dataclass, field
from typing import List, Dict, Optional

# ── Severity weights ──────────────────────────────────────────────────────────
SEVERITY_WEIGHTS = {
    "CRITICAL": 35,
    "HIGH":     20,
    "MEDIUM":   10,
    "LOW":       5,
}

# ── Master Fraud Taxonomy ─────────────────────────────────────────────────────
# Format: (pattern_regex, severity, category, plain_english_explanation)
FRAUD_PATTERNS: List[tuple] = [

    # ── A. SENSITIVE DATA REQUESTS ─────────────────────────────────────────────
    (r"\botp\b",                         "CRITICAL", "sensitive_data_request",  "Requesting OTP — no legitimate organization ever asks for OTP"),
    (r"\bone.?time.?password",           "CRITICAL", "sensitive_data_request",  "Requesting one-time password"),
    (r"\bcvv\b",                         "CRITICAL", "sensitive_data_request",  "Requesting CVV — banks never ask for card CVV"),
    (r"\bcard.?number\b",                "CRITICAL", "sensitive_data_request",  "Requesting full card number"),
    (r"\bpin\b",                         "CRITICAL", "sensitive_data_request",  "Requesting PIN — banks never ask for PIN over call"),
    (r"\bupi.?pin\b",                    "CRITICAL", "sensitive_data_request",  "Requesting UPI PIN"),
    (r"\baadhaar\b",                     "HIGH",     "sensitive_data_request",  "Requesting Aadhaar number"),
    (r"\baadhaar.?(number|card|otp|linked)", "CRITICAL", "sensitive_data_request", "Requesting Aadhaar-linked details or OTP"),
    (r"\bpan.?card\b",                   "HIGH",     "sensitive_data_request",  "Requesting PAN card number"),
    (r"\baccount.?number\b",             "HIGH",     "sensitive_data_request",  "Requesting bank account number"),
    (r"\bifsc\b",                        "HIGH",     "sensitive_data_request",  "Requesting IFSC code"),
    (r"\bnet.?banking.?(password|credentials|login)", "CRITICAL", "sensitive_data_request", "Requesting net banking credentials"),
    (r"\bkyc.?(update|verify|complete|pending|expire)", "HIGH",  "sensitive_data_request",  "KYC update pretext — common fraud vector"),
    (r"\bverif(y|ication).?(account|identity|details|card)", "MEDIUM", "sensitive_data_request", "Verification request — check caller legitimacy"),
    (r"\bshare.?(your|the).?(otp|pin|password|code|number)", "CRITICAL", "sensitive_data_request", "Direct instruction to share sensitive credential"),
    (r"\bconfirm.?(your|the).?(otp|pin|password|details)", "CRITICAL", "sensitive_data_request", "Asking to confirm sensitive credential"),
    (r"\bwallet.?(pin|password|linked)",  "HIGH",    "sensitive_data_request",  "Requesting mobile wallet credentials"),
    (r"\bremote.?(access|desktop|anydesk|teamviewer|screensh)", "CRITICAL", "sensitive_data_request", "Requesting remote access — major red flag"),

    # ── B. URGENCY & PRESSURE ──────────────────────────────────────────────────
    (r"\bimmediately\b",                 "HIGH",     "urgency_pressure",  "Immediate action demand — pressure tactic"),
    (r"\bright now\b",                   "HIGH",     "urgency_pressure",  "Right now pressure — manufactured urgency"),
    (r"\bwithin.?\d+.?(minutes?|hours?|seconds?)", "HIGH", "urgency_pressure", "Time-bound threat — classic pressure pattern"),
    (r"\b(last|final).?chance\b",        "HIGH",     "urgency_pressure",  "Last chance framing — scarcity tactic"),
    (r"\bfinal.?warning\b",              "HIGH",     "urgency_pressure",  "Final warning — fear-inducing threat"),
    (r"\bwill be (blocked|suspended|frozen|terminated|cancelled)", "HIGH", "urgency_pressure", "Account action threat — pressure tactic"),
    (r"\baccount.?(block|suspend|freez|clos|terminat)", "HIGH", "urgency_pressure", "Account blocking threat"),
    (r"\bdo.?not.?(hang up|disconnect|cut the call|end the call)", "HIGH", "urgency_pressure", "Call control tactic — preventing verification"),
    (r"\bstay on.?(the )?line\b",        "MEDIUM",   "urgency_pressure",  "Keeping target on call to prevent verification"),
    (r"\bno time.?to (waste|lose|delay)", "MEDIUM",  "urgency_pressure",  "Artificial time pressure"),
    (r"\burgent(ly)?\b",                 "MEDIUM",   "urgency_pressure",  "Urgency language"),
    (r"\bdeadline\b",                    "MEDIUM",   "urgency_pressure",  "Deadline framing"),
    (r"\bexpire(s|d|ing)?.?(today|soon|now|in \d)", "HIGH", "urgency_pressure", "Expiry threat — urgency manufacturing"),
    (r"\blast day\b",                    "MEDIUM",   "urgency_pressure",  "Last day claim — urgency pressure"),
    (r"\bpenalt(y|ies).?(will|may|shall)", "HIGH",   "urgency_pressure",  "Penalty threat to force compliance"),
    (r"\barrest.?(warrant|order|notice)", "CRITICAL", "urgency_pressure", "Arrest threat — extreme fear pressure tactic"),
    (r"\blegal action.?(will|shall|may|taken)", "HIGH", "urgency_pressure", "Legal action threat"),

    # ── C. AUTHORITY IMPERSONATION ─────────────────────────────────────────────
    (r"\b(calling|speaking|from|officer|department).{0,20}(rbi|reserve bank)", "CRITICAL", "authority_impersonation", "Claiming RBI identity — RBI never calls individuals"),
    (r"\b(calling|speaking|from|officer).{0,20}(sbi|hdfc|icici|axis|kotak|bank)", "HIGH", "authority_impersonation", "Claiming bank identity — verify through official number"),
    (r"\bcybercrime.?(department|cell|division|officer|branch)", "CRITICAL", "authority_impersonation", "Cybercrime dept impersonation — very common vishing script"),
    (r"\bincome.?tax.?(department|officer|notice|raid)", "CRITICAL", "authority_impersonation", "Income tax impersonation"),
    (r"\b(ed|enforcement directorate)\b", "CRITICAL", "authority_impersonation", "Enforcement Directorate impersonation"),
    (r"\bcbi\b.{0,20}(officer|calling|department|notice)", "CRITICAL", "authority_impersonation", "CBI impersonation"),
    (r"\bpolice.?(department|station|officer|inspector)", "HIGH",    "authority_impersonation", "Police impersonation"),
    (r"\b(trai|telecom regulator).{0,30}(disconnect|block|suspend|action)", "HIGH", "authority_impersonation", "TRAI impersonation — SIM blocking scam"),
    (r"\bnpci\b",                        "HIGH",     "authority_impersonation", "NPCI impersonation"),
    (r"\bsebi\b",                        "HIGH",     "authority_impersonation", "SEBI impersonation"),
    (r"\bgovernment.?(scheme|portal|official|department)", "MEDIUM", "authority_impersonation", "Government authority claim"),
    (r"\bofficial.?(representative|agent|officer|executive)", "MEDIUM", "authority_impersonation", "Official representative claim"),
    (r"\bheadquarters\b",                "LOW",      "authority_impersonation", "Headquarters reference — legitimacy building"),
    (r"\bcomplaint.?registered.?(against you|in your name)", "HIGH", "authority_impersonation", "Complaint registered claim — threat framing"),

    # ── D. PSYCHOLOGICAL MANIPULATION ─────────────────────────────────────────
    (r"\byou will be arrested\b",        "CRITICAL", "psychological_manipulation", "Arrest threat — extreme fear induction"),
    (r"\byour (name|number|aadhaar|account).{0,20}(fraud|illegal|criminal|money laundering)", "CRITICAL", "psychological_manipulation", "Implicating target in crime — coercion tactic"),
    (r"\bmoney.?launder",                "CRITICAL", "psychological_manipulation", "Money laundering accusation"),
    (r"\bnarcotics\b",                   "CRITICAL", "psychological_manipulation", "Narcotics link claim — extreme fear pressure"),
    (r"\bdon.?t.?tell.?(anyone|family|police|husband|wife)", "CRITICAL", "psychological_manipulation", "Secrecy demand — isolation tactic"),
    (r"\bkeep.?(this|it).?(confidential|secret|between us)", "HIGH", "psychological_manipulation", "Secrecy/isolation demand"),
    (r"\bprotect.?(your|the).?(account|money|funds|savings)", "MEDIUM", "psychological_manipulation", "False protection framing"),
    (r"\byou.?have.?won\b",              "HIGH",     "psychological_manipulation", "Prize/lottery scam opening"),
    (r"\blucky.?(draw|winner|selected)", "HIGH",     "psychological_manipulation", "Lottery/lucky draw scam"),
    (r"\bcashback.?(offer|reward|bonus)", "MEDIUM",  "psychological_manipulation", "Fake cashback bait"),
    (r"\brefund.?(process|pending|credit|approve)", "HIGH", "psychological_manipulation", "Fake refund scam — very common"),
    (r"\bhelp.?(me|us).?(transfer|move|safe).?(money|funds)", "CRITICAL", "psychological_manipulation", "Money mule recruitment attempt"),
    (r"\bfear\b.{0,15}(account|arrest|action|problem)", "HIGH", "psychological_manipulation", "Explicit fear language"),
    (r"\bdo.?not.?(worry|panic).{0,20}(just|only|simply).{0,10}(share|give|provide)", "HIGH", "psychological_manipulation", "False reassurance before data extraction"),

    # ── E. FINANCIAL TRANSACTION FRAUD ────────────────────────────────────────
    (r"\btransfer.{0,20}(amount|money|fund).{0,20}(safe|another|different|government).{0,10}(account|wallet)", "CRITICAL", "financial_fraud", "Requesting fund transfer to 'safe' account — classic fraud"),
    (r"\bsend.{0,10}(money|amount|rs|inr|rupees).{0,20}(link|upi|number|qr)", "CRITICAL", "financial_fraud", "Payment request via link/QR/UPI"),
    (r"\bscan.{0,10}(qr|code|barcode)",  "HIGH",     "financial_fraud",  "QR code scan request — payment fraud"),
    (r"\bclick.{0,15}(link|here|button|below)", "HIGH", "financial_fraud", "Link click instruction — phishing"),
    (r"\bdownload.{0,15}(app|application|apk|software)", "HIGH", "financial_fraud", "App download request — malware risk"),
    (r"\binstall.{0,15}(app|anydesk|teamviewer|quick support)", "CRITICAL", "financial_fraud", "Remote access app install — critical fraud signal"),
    (r"\bprocessing.?fee\b",             "HIGH",     "financial_fraud",  "Processing fee — advance fee fraud"),
    (r"\bregistration.?fee\b",           "HIGH",     "financial_fraud",  "Registration fee — advance fee fraud"),
    (r"\btax.{0,10}(pay|clear|settle).{0,10}(release|prize|winnings)", "HIGH", "financial_fraud", "Tax payment to release prize — advance fee scam"),

    # ── F. INVESTMENT / TRADING FRAUD ─────────────────────────────────────────
    (r"\bguaranteed.?(return|profit|income|earning)", "HIGH",   "investment_fraud", "Guaranteed returns — investment scam"),
    (r"\bdouble.{0,10}(your|the).{0,10}(money|investment|amount)", "HIGH", "investment_fraud", "Money doubling claim — Ponzi signal"),
    (r"\b(stock|share|crypto|nft|forex).{0,20}(tip|advice|sure|certain|guaranteed)", "HIGH", "investment_fraud", "Guaranteed trading tip — SEBI violation"),
    (r"\brisk.?free.?invest",            "HIGH",     "investment_fraud", "Risk-free investment claim — no such thing"),
    (r"\bjoin.{0,15}(whatsapp|telegram).{0,15}(group|channel).{0,20}(invest|profit|earn)", "HIGH", "investment_fraud", "Social media investment group recruitment"),

    # ── G. JOB / EMPLOYMENT FRAUD ─────────────────────────────────────────────
    (r"\bwork.?from.?home.{0,20}(earn|income|salary|daily)", "MEDIUM", "job_fraud", "Work from home income claim — job fraud pattern"),
    (r"\bpart.?time.{0,20}(earn|income|daily|weekly)", "MEDIUM", "job_fraud", "Part-time earning claim"),
    (r"\btask.{0,10}(complete|finish|done).{0,10}(earn|paid|credit|reward)", "HIGH", "job_fraud", "Task completion payment — job fraud"),
    (r"\bregistration.{0,10}(fee|charge|amount).{0,10}(join|start|access)", "HIGH", "job_fraud", "Registration fee for job — fraud signal"),

    # ── H. SYNTHETIC AUDIO / AI TEST PHRASES ──────────────────────────────────
    (r"\b(synthesized|artificial|elevenlabs|voice clone|language model|ai generated|test of)\b", "CRITICAL", "synthetic_audio", "Explicit mention of synthetic/test audio detected"),
]

# ── Category display names ────────────────────────────────────────────────────
CATEGORY_LABELS = {
    "sensitive_data_request":    "Sensitive Data Request",
    "urgency_pressure":          "Urgency & Pressure",
    "authority_impersonation":   "Authority Impersonation",
    "psychological_manipulation": "Psychological Manipulation",
    "financial_fraud":           "Financial Transaction Fraud",
    "investment_fraud":          "Investment / Trading Fraud",
    "job_fraud":                 "Job / Employment Fraud",
    "synthetic_audio":           "Synthetic / Test Audio Detected",
}


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class FlaggedSegment:
    text: str
    timestamp_sec: Optional[float]
    category: str
    category_label: str
    severity: str
    weight: int
    pattern_matched: str
    explanation: str

@dataclass
class CategoryResult:
    category: str
    label: str
    detected: bool
    score: int          # 0-100
    hit_count: int
    severity_breakdown: Dict[str, int] = field(default_factory=dict)

@dataclass
class SocialEngineeringResult:
    fraud_intent_score: int         # 0-100
    threat_level: str               # LOW / MODERATE / HIGH / CRITICAL
    sensitive_data_requested: bool
    authority_impersonation: bool
    urgency_level: str              # None / Low / Moderate / High
    flagged_segments: List[FlaggedSegment]
    category_results: Dict[str, CategoryResult]
    total_pattern_hits: int
    plain_english_summary: str
    recommended_action: str


# ── Core detection engine ─────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    """Lowercase, collapse whitespace, strip punctuation noise."""
    text = text.lower()
    text = re.sub(r"[^\w\s\.\-\/]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _split_sentences(text: str) -> List[str]:
    """Split transcript into sentences for per-sentence analysis."""
    # Split on . ! ? and also on newlines
    sentences = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [s.strip() for s in sentences if len(s.strip()) > 8]


def _detect_patterns(text: str) -> List[tuple]:
    """Run all regex patterns against normalized text. Returns (pattern, severity, category, explanation) matches."""
    norm = _normalize(text)
    hits = []
    for pattern, severity, category, explanation in FRAUD_PATTERNS:
        if re.search(pattern, norm):
            hits.append((pattern, severity, category, explanation))
    return hits


def _compute_compounding_boost(hits: List[tuple]) -> float:
    """
    If multiple patterns fire on the same sentence, boost the score.
    Each additional pattern adds 15% to the total for that sentence.
    """
    if len(hits) <= 1:
        return 1.0
    return 1.0 + (len(hits) - 1) * 0.15


def _score_urgency(category_results: Dict[str, CategoryResult]) -> str:
    urgency = category_results.get("urgency_pressure")
    if not urgency or not urgency.detected:
        return "None"
    if urgency.score >= 60:
        return "High"
    if urgency.score >= 30:
        return "Moderate"
    return "Low"


def _build_summary(result: "SocialEngineeringResult") -> str:
    parts = []
    if result.fraud_intent_score >= 75:
        parts.append("Multiple high-severity fraud indicators detected.")
    elif result.fraud_intent_score >= 45:
        parts.append("Suspicious patterns detected in the audio transcript.")

    cats = [r.label for r in result.category_results.values() if r.detected]
    if cats:
        parts.append(f"Detected categories: {', '.join(cats)}.")

    if result.sensitive_data_requested:
        parts.append("WARNING: Caller is requesting sensitive financial credentials. No legitimate organization asks for OTP, PIN or CVV over a phone call.")
    if result.authority_impersonation:
        parts.append("WARNING: Caller is claiming to represent an authority (bank, government, law enforcement). Verify independently before sharing any information.")
    if result.urgency_level in ("High", "Moderate"):
        parts.append(f"Urgency pressure level is {result.urgency_level}. Manufactured urgency is a hallmark of social engineering.")

    return " ".join(parts) if parts else "No significant fraud indicators detected in transcript."


def _recommended_action(score: int, sensitive: bool, authority: bool) -> str:
    if score >= 76 or (sensitive and authority):
        return "CRITICAL: Do not share any information. End the call immediately. Report to Cybercrime Helpline 1930 or file at cybercrime.gov.in."
    if score >= 51 or sensitive:
        return "HIGH RISK: Do not share OTP, PIN, CVV or any credentials. Hang up and call back on the bank's official number."
    if score >= 26:
        return "CAUTION: Verify the caller's identity through an independent channel before sharing any information."
    return "Low risk detected. Exercise standard caution."


# ── Public entry point ────────────────────────────────────────────────────────

def analyze(
    transcript: str,
    word_timestamps: Optional[List[Dict]] = None,
) -> SocialEngineeringResult:
    """
    Analyze a transcript for social engineering / fraud patterns.

    Args:
        transcript: Full text of the audio transcript.
        word_timestamps: Optional list of {word: str, start: float, end: float} dicts
                         from Whisper or any ASR. Used to attach timestamps to flags.

    Returns:
        SocialEngineeringResult with scores, flags, and recommendations.
    """

    if not transcript or not transcript.strip():
        return SocialEngineeringResult(
            fraud_intent_score=-1,   # -1 = NOT_RUN (distinct from 0 = clean)
            threat_level="UNKNOWN",
            sensitive_data_requested=False,
            authority_impersonation=False,
            urgency_level="Unknown",
            flagged_segments=[],
            category_results={},
            total_pattern_hits=0,
            plain_english_summary="⚠️ Speech-to-text unavailable. ASR engine could not load — check transformers/torch installation.",
            recommended_action="Cannot assess fraud risk without transcript. Check that transformers and torch are installed correctly, or use the manual transcript input.",
        )

    sentences = _split_sentences(transcript)
    flagged_segments: List[FlaggedSegment] = []
    category_raw_scores: Dict[str, List[int]] = {cat: [] for cat in CATEGORY_LABELS}
    total_weighted_score = 0
    max_possible = 0

    # Build a simple word→timestamp lookup for attaching times to flags
    word_ts_map: Dict[str, float] = {}
    if word_timestamps:
        for wt in word_timestamps:
            word_ts_map[_normalize(wt.get("word", ""))] = wt.get("start", 0.0)

    def _estimate_timestamp(sentence: str) -> Optional[float]:
        if not word_ts_map:
            return None
        words = _normalize(sentence).split()
        for w in words:
            if w in word_ts_map:
                return round(word_ts_map[w], 2)
        return None

    # Sentence-level analysis
    for sentence in sentences:
        hits = _detect_patterns(sentence)
        if not hits:
            continue

        boost = _compute_compounding_boost(hits)
        ts = _estimate_timestamp(sentence)

        for pattern, severity, category, explanation in hits:
            weight = SEVERITY_WEIGHTS[severity]
            boosted_weight = int(weight * boost)

            flagged_segments.append(FlaggedSegment(
                text=sentence,
                timestamp_sec=ts,
                category=category,
                category_label=CATEGORY_LABELS.get(category, category),
                severity=severity,
                weight=boosted_weight,
                pattern_matched=pattern,
                explanation=explanation,
            ))

            if category in category_raw_scores:
                category_raw_scores[category].append(boosted_weight)

            total_weighted_score += boosted_weight

    # Normalize total score to 0-100
    # Max theoretical score capped at 200 (multiple CRITICAL hits)
    MAX_NORM = 200
    fraud_intent_score = int(min(100, (total_weighted_score / MAX_NORM) * 100))

    # Per-category results
    category_results: Dict[str, CategoryResult] = {}
    for cat, label in CATEGORY_LABELS.items():
        raw = category_raw_scores.get(cat, [])
        cat_total = sum(raw)
        cat_score = int(min(100, (cat_total / 80) * 100))
        severity_breakdown: Dict[str, int] = {}
        for seg in flagged_segments:
            if seg.category == cat:
                severity_breakdown[seg.severity] = severity_breakdown.get(seg.severity, 0) + 1
        category_results[cat] = CategoryResult(
            category=cat,
            label=label,
            detected=len(raw) > 0,
            score=cat_score,
            hit_count=len(raw),
            severity_breakdown=severity_breakdown,
        )

    # Derived flags
    sensitive_data_requested = category_results["sensitive_data_request"].detected
    authority_impersonation = category_results["authority_impersonation"].detected
    urgency_level = _score_urgency(category_results)

    # Threat level
    if fraud_intent_score >= 76:
        threat_level = "CRITICAL"
    elif fraud_intent_score >= 51:
        threat_level = "HIGH"
    elif fraud_intent_score >= 26:
        threat_level = "MODERATE"
    else:
        threat_level = "LOW"

    # Escalate threat level if critical patterns present even at low score
    if sensitive_data_requested and authority_impersonation:
        if threat_level in ("LOW", "MODERATE"):
            threat_level = "HIGH"
            fraud_intent_score = max(fraud_intent_score, 92)

    if threat_level == "CRITICAL":
        fraud_intent_score = max(fraud_intent_score, 95)
    elif threat_level == "HIGH":
        fraud_intent_score = max(fraud_intent_score, 85)

    result = SocialEngineeringResult(
        fraud_intent_score=fraud_intent_score,
        threat_level=threat_level,
        sensitive_data_requested=sensitive_data_requested,
        authority_impersonation=authority_impersonation,
        urgency_level=urgency_level,
        flagged_segments=flagged_segments,
        category_results=category_results,
        total_pattern_hits=len(flagged_segments),
        plain_english_summary="",
        recommended_action="",
    )

    result.plain_english_summary = _build_summary(result)
    result.recommended_action = _recommended_action(fraud_intent_score, sensitive_data_requested, authority_impersonation)
    return result


def run(transcript: str, word_timestamps: Optional[List[Dict]] = None) -> dict:
    """
    Wrapper that returns JSON-serializable dict for the API layer.
    """
    r = analyze(transcript, word_timestamps)

    not_run = r.fraud_intent_score == -1

    return {
        "layer": "Social Engineering Detection",
        "score": 50 if not_run else (100 - r.fraud_intent_score),
        "status": (
            "NOT_RUN" if not_run
            else "FAIL" if r.threat_level in ("CRITICAL", "HIGH")
            else "SUSPICIOUS" if r.threat_level == "MODERATE"
            else "PASS"
        ),
        "anomaly_detected": r.total_pattern_hits > 0,
        "asr_available": not not_run,
        "sub_metrics": {
            "fraud_intent_score":       {"score": 0 if not_run else r.fraud_intent_score, "detail": "ASR loading — first run downloads model (~39MB)" if not_run else f"Fraud intent: {r.threat_level}", "anomaly": False if not_run else r.fraud_intent_score > 25},
            "sensitive_data_requested": {"score": 50 if not_run else (0 if r.sensitive_data_requested else 100), "detail": "Unknown — no transcript" if not_run else ("Detected" if r.sensitive_data_requested else "Not detected"), "anomaly": r.sensitive_data_requested},
            "authority_impersonation":  {"score": 50 if not_run else (0 if r.authority_impersonation else 100), "detail": "Unknown — no transcript" if not_run else ("Detected" if r.authority_impersonation else "Not detected"), "anomaly": r.authority_impersonation},
            "urgency_pressure":         {"score": 50 if not_run else {"High": 0, "Moderate": 40, "Low": 70, "None": 100, "Unknown": 50}[r.urgency_level], "detail": "Unknown — no transcript" if not_run else f"Urgency level: {r.urgency_level}", "anomaly": r.urgency_level in ("High", "Moderate")},
        },
        "threat_level": r.threat_level,
        "fraud_intent_score": r.fraud_intent_score,
        "sensitive_data_requested": r.sensitive_data_requested,
        "authority_impersonation": r.authority_impersonation,
        "urgency_level": r.urgency_level,
        "total_pattern_hits": r.total_pattern_hits,
        "recommended_action": r.recommended_action,
        "plain_english_summary": r.plain_english_summary,
        "flagged_segments": [
            {
                "text": seg.text,
                "timestamp_sec": seg.timestamp_sec,
                "category": seg.category,
                "category_label": seg.category_label,
                "severity": seg.severity,
                "explanation": seg.explanation,
            }
            for seg in r.flagged_segments
        ],
        "category_results": {
            cat: {
                "label": cr.label,
                "detected": cr.detected,
                "score": cr.score,
                "hit_count": cr.hit_count,
                "severity_breakdown": cr.severity_breakdown,
            }
            for cat, cr in r.category_results.items()
        },
    }