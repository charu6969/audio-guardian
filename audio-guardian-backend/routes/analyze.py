"""
Analysis Routes — v3 (Social Engineering Detection added)
POST /api/analyze          - Full 7-layer forensic + fraud analysis
POST /api/analyze/text     - Social engineering scan on raw text transcript
POST /api/report           - PDF forensic report
POST /api/compare          - Voice clone detection
"""

import os
import tempfile
import traceback

import numpy as np
import librosa
from fastapi import APIRouter, File, UploadFile, HTTPException, Body
from fastapi.responses import StreamingResponse, JSONResponse
import io

from services import biological, digital_integrity, environmental, temporal, splice_detection
from services import deepfake_classifier, spectrogram as spectrogram_svc
from services import report as report_gen
from services import social_engineering, asr

router = APIRouter()

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aac"}
MAX_FILE_SIZE_MB = 50


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_audio(filepath: str):
    return librosa.load(filepath, sr=None, mono=True)


def _get_file_metadata(filepath: str, filename: str, y: np.ndarray, sr: int, file_hash: str) -> dict:
    return {
        "filename": filename,
        "file_size_bytes": int(os.path.getsize(filepath)),
        "duration_sec": round(float(len(y) / sr), 3),
        "sample_rate": int(sr),
        "format": os.path.splitext(filename)[1].lstrip(".").upper() or "UNKNOWN",
        "file_hash": file_hash,
    }


def _compute_trust_score(layers: list) -> int:
    """
    Layer weights — Social Engineering gets highest weight as real-world threat signal.
    """
    weights = {
        "Biological Signature":       0.12,
        "Digital Integrity":          0.10,
        "Environmental Consistency":  0.10,
        "Temporal Coherence":         0.10,
        "Cross-Modal Fingerprint":    0.10,
        "ML Deepfake Classifier":     0.18,
        "Social Engineering Detection": 0.30,  # highest — most actionable signal
    }
    total_w, total_s = 0.0, 0.0
    for layer in layers:
        w = weights.get(layer["layer"], 0.08)
        total_s += layer["score"] * w
        total_w += w
    return int(round(total_s / total_w)) if total_w > 0 else 50


def _determine_verdict(trust_score: int, layers: list) -> str:
    n_fail = sum(1 for l in layers if l["status"] == "FAIL")

    # Pull social engineering result for fast-path verdict
    se_layer = next((l for l in layers if l["layer"] == "Social Engineering Detection"), None)
    threat_level = se_layer.get("threat_level", "LOW") if se_layer else "LOW"

    # Fast-path: if fraud intent is CRITICAL, verdict is immediate
    if threat_level == "CRITICAL":
        return "FRAUD ATTEMPT DETECTED"
    if threat_level == "HIGH":
        return "HIGH FRAUD RISK"

    # Standard path
    ml_layer = next((l for l in layers if l["layer"] == "ML Deepfake Classifier"), None)
    ml_score = ml_layer["score"] if ml_layer else trust_score

    if trust_score >= 78 and n_fail == 0 and ml_score >= 65:
        return "AUTHENTIC"
    elif trust_score >= 62 and n_fail <= 1 and ml_score >= 55:
        return "LIKELY AUTHENTIC"
    elif trust_score >= 45 or (n_fail >= 2):
        return "SUSPICIOUS"
    elif trust_score >= 28:
        return "LIKELY SYNTHETIC"
    else:
        return "SYNTHETIC / MANIPULATED"


def _run_layer(name: str, fn, *args) -> dict:
    try:
        return fn(*args)
    except Exception as e:
        print(f"[Layer: {name}] Error: {e}")
        return {
            "layer": name, "score": 50, "status": "SUSPICIOUS",
            "anomaly_detected": False, "sub_metrics": {}, "error": str(e),
        }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    """
    Full 7-layer forensic + fraud trust audit.
    Layer 7 (Social Engineering) runs on Whisper transcript if available,
    otherwise skips transcription and returns a partial SE result.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await file.read()
            if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
                raise HTTPException(413, f"File exceeds {MAX_FILE_SIZE_MB}MB")
            tmp.write(content)
            tmp_path = tmp.name

        try:
            y, sr = _load_audio(tmp_path)
        except Exception as e:
            raise HTTPException(422, f"Cannot decode audio: {e}")

        if len(y) < sr * 0.5:
            raise HTTPException(422, "Audio too short (minimum 0.5s)")

        # ── Transcription (Whisper if available) ────────────────────────────
        transcript = ""
        word_timestamps = []
        asr_available = asr.is_available()
        if asr_available:
            transcript, word_timestamps = asr.transcribe_from_array(y, sr)

        # ── 7 forensic layers ────────────────────────────────────────────────
        di = _run_layer("Digital Integrity", digital_integrity.run, tmp_path, y, sr)

        layers = [
            _run_layer("Biological Signature",       biological.run,           y, sr),
            di,
            _run_layer("Environmental Consistency",  environmental.run,        y, sr),
            _run_layer("Temporal Coherence",         temporal.run,             y, sr),
            _run_layer("Cross-Modal Fingerprint",    splice_detection.run,     y, sr),
            _run_layer("ML Deepfake Classifier",     deepfake_classifier.run,  y, sr),
            _run_layer("Social Engineering Detection",
                       social_engineering.run, transcript, word_timestamps),
        ]

        trust_score = _compute_trust_score(layers)
        verdict = _determine_verdict(trust_score, layers)
        file_hash = di.get("file_hash", "")

        # ── Spectrogram + anomaly viz ─────────────────────────────────────────
        viz = spectrogram_svc.generate(y, sr)
        metadata = _get_file_metadata(tmp_path, file.filename or "audio", y, sr, file_hash)

        # Pull SE summary for top-level convenience fields
        se_layer = next((l for l in layers if l["layer"] == "Social Engineering Detection"), {})

        return JSONResponse(content={
            "success": True,
            "verdict": verdict,
            "trust_score": trust_score,
            "file_metadata": metadata,
            "layers": layers,
            "visualization": {
                "spectrogram_b64": viz.get("spectrogram_b64"),
                "waveform_envelope": viz.get("waveform_envelope"),
                "frequency_bands": viz.get("frequency_bands"),
                "anomaly_markers": viz.get("anomaly_markers"),
                "duration_sec": viz.get("duration_sec"),
                "sample_rate": viz.get("sample_rate"),
            },
            # ── Top-level fraud summary (convenience for frontend) ─────────────
            "fraud_summary": {
                "threat_level": se_layer.get("threat_level", "LOW"),
                "fraud_intent_score": se_layer.get("fraud_intent_score", 0),
                "sensitive_data_requested": se_layer.get("sensitive_data_requested", False),
                "authority_impersonation": se_layer.get("authority_impersonation", False),
                "urgency_level": se_layer.get("urgency_level", "None"),
                "recommended_action": se_layer.get("recommended_action", ""),
                "plain_english_summary": se_layer.get("plain_english_summary", ""),
                "flagged_segments": se_layer.get("flagged_segments", []),
                "transcript": transcript,
                "asr_available": asr_available,
            },
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {e}\n{traceback.format_exc()}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/analyze/text")
async def analyze_text(payload: dict = Body(...)):
    """
    Social engineering scan on a raw text transcript (no audio needed).
    Use this for:
      - Testing detection against a script
      - Scanning SMS/WhatsApp message text
      - Manual transcript entry

    Body: { "transcript": "This is calling from RBI..." }
    """
    transcript = payload.get("transcript", "").strip()
    if not transcript:
        raise HTTPException(400, "transcript field is required and cannot be empty")
    if len(transcript) > 50000:
        raise HTTPException(400, "Transcript too long (max 50,000 characters)")

    result = social_engineering.run(transcript)

    return JSONResponse(content={
        "success": True,
        "transcript": transcript,
        "social_engineering_analysis": result,
    })


@router.post("/report")
async def generate_report(analysis_result: dict):
    try:
        pdf_bytes = report_gen.generate(analysis_result)
        fname = analysis_result.get("file_metadata", {}).get("filename", "audio")
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="AudioNotary_Report_{fname}.pdf"'},
        )
    except Exception as e:
        raise HTTPException(500, f"Report generation failed: {e}")


@router.post("/compare")
async def compare_audio(
    reference: UploadFile = File(...),
    disputed: UploadFile = File(...),
):
    tmp_ref = tmp_disp = None
    try:
        ref_ext = os.path.splitext(reference.filename or "")[1].lower() or ".wav"
        disp_ext = os.path.splitext(disputed.filename or "")[1].lower() or ".wav"

        with tempfile.NamedTemporaryFile(delete=False, suffix=ref_ext) as f:
            f.write(await reference.read())
            tmp_ref = f.name
        with tempfile.NamedTemporaryFile(delete=False, suffix=disp_ext) as f:
            f.write(await disputed.read())
            tmp_disp = f.name

        y_ref, sr_ref = _load_audio(tmp_ref)
        y_disp, sr_disp = _load_audio(tmp_disp)

        if sr_ref != sr_disp:
            y_disp = librosa.resample(y_disp, orig_sr=sr_disp, target_sr=sr_ref)

        def embed(y, sr):
            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)
            delta = librosa.feature.delta(mfcc)
            contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
            return np.concatenate([np.mean(mfcc, axis=1), np.mean(delta, axis=1), np.mean(contrast, axis=1)])

        emb_ref = embed(y_ref, sr_ref)
        emb_disp = embed(y_disp, sr_ref)
        cosine_sim = float(np.dot(emb_ref, emb_disp) /
                           (np.linalg.norm(emb_ref) * np.linalg.norm(emb_disp) + 1e-8))
        similarity_pct = int(np.clip(cosine_sim * 100, 0, 100))
        ml_verdict = deepfake_classifier.run(y_disp, sr_ref)

        if similarity_pct >= 85:
            clone_verdict, risk = "HIGH SIMILARITY — Likely Same Speaker or Voice Clone", "HIGH"
        elif similarity_pct >= 65:
            clone_verdict, risk = "MODERATE SIMILARITY — Possible Voice Clone", "MEDIUM"
        elif similarity_pct >= 45:
            clone_verdict, risk = "LOW SIMILARITY — Likely Different Speakers", "LOW"
        else:
            clone_verdict, risk = "VERY LOW SIMILARITY — Different Speakers", "NONE"

        return JSONResponse(content={
            "success": True,
            "voice_similarity_score": similarity_pct,
            "clone_verdict": clone_verdict,
            "risk_level": risk,
            "disputed_file_ml_analysis": ml_verdict,
            "reference_file": reference.filename,
            "disputed_file": disputed.filename,
        })

    except Exception as e:
        raise HTTPException(500, f"Comparison failed: {e}")
    finally:
        for p in [tmp_ref, tmp_disp]:
            if p and os.path.exists(p):
                os.unlink(p)