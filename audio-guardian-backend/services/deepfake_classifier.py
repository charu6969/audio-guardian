"""
ML Deepfake Classifier — Layer 6
Uses a pretrained HuggingFace wav2vec2 model fine-tuned on audio deepfake detection.

Primary model: "motheecreator/wav2vec2-Fake-audio-detection"
Fallback:      Feature-engineering ensemble (MFCC + spectral + GAN artifact detection)
               used automatically if the model cannot be downloaded (no internet, etc.)

This layer gives you a genuine neural network verdict on top of the signal-processing layers.
"""

import numpy as np
import librosa
from scipy.stats import kurtosis, skew
import warnings

warnings.filterwarnings("ignore")

# ── Model loading (lazy, cached) ──────────────────────────────────────────────
_pipeline = None
_pipeline_attempted = False
TARGET_SR = 16000  # wav2vec2 expects 16 kHz


def _try_load_model():
    """
    Attempt to load the HuggingFace pipeline once, cache result.
    Returns the pipeline or None if unavailable.
    """
    global _pipeline, _pipeline_attempted
    if _pipeline_attempted:
        return _pipeline
    _pipeline_attempted = True
    try:
        from transformers import pipeline as hf_pipeline
        print("[DeepfakeClassifier] Loading wav2vec2 deepfake detection model...")
        _pipeline = hf_pipeline(
            "audio-classification",
            model="motheecreator/wav2vec2-Fake-audio-detection",
            device=-1,  # CPU — change to 0 for GPU
        )
        print("[DeepfakeClassifier] Model loaded successfully.")
    except Exception as e:
        print(f"[DeepfakeClassifier] Model unavailable, using fallback: {e}")
        _pipeline = None
    return _pipeline


# ── HuggingFace ML path ───────────────────────────────────────────────────────

def _classify_with_model(y: np.ndarray, sr: int) -> dict:
    """Run the wav2vec2 pipeline and parse its output."""
    pipe = _try_load_model()
    if pipe is None:
        return None  # signal to use fallback

    # Resample to 16 kHz
    if sr != TARGET_SR:
        y = librosa.resample(y, orig_sr=sr, target_sr=TARGET_SR)

    # Clip to 10s max (model memory)
    max_samples = TARGET_SR * 10
    if len(y) > max_samples:
        # Use middle chunk — most representative
        start = (len(y) - max_samples) // 2
        y = y[start: start + max_samples]

    # Normalise amplitude
    peak = np.max(np.abs(y))
    if peak > 0:
        y = y / peak

    try:
        results = pipe({"array": y, "sampling_rate": TARGET_SR})
        # results: [{"label": "fake"/"real", "score": 0.0–1.0}, ...]
        label_map = {r["label"].lower(): r["score"] for r in results}

        real_prob = label_map.get("real", label_map.get("bonafide", 0.0))
        fake_prob = label_map.get("fake", label_map.get("spoof", label_map.get("synthetic", 0.0)))

        # Normalise in case labels differ
        total = real_prob + fake_prob
        if total > 0:
            real_prob /= total
            fake_prob /= total
        else:
            real_prob, fake_prob = 0.5, 0.5

        score = int(real_prob * 100)
        anomaly = fake_prob > 0.55
        detail = (
            f"ML model verdict: {'REAL' if real_prob > 0.5 else 'FAKE'} "
            f"(real_prob={real_prob:.2%}, fake_prob={fake_prob:.2%})"
        )
        return {
            "score": score,
            "detail": detail,
            "anomaly": anomaly,
            "real_probability": float(real_prob),
            "fake_probability": float(fake_prob),
            "model": "wav2vec2-Fake-audio-detection",
            "source": "ml_model",
        }
    except Exception as e:
        return None  # fallback


# ── Feature-engineering fallback ─────────────────────────────────────────────

def _gan_artifact_score(y: np.ndarray, sr: int) -> float:
    """
    GAN / vocoder artifacts manifest as:
    - Periodic spectral patterns at harmonic multiples
    - Unnaturally low high-frequency noise
    - Quantisation-like MFCC distribution
    Returns 0.0 (clearly fake) → 1.0 (clearly real)
    """
    try:
        # High-frequency energy ratio (above 4 kHz)
        stft = np.abs(librosa.stft(y, n_fft=2048))
        freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
        hf_mask = freqs > 4000
        hf_energy = np.mean(stft[hf_mask, :]) if hf_mask.any() else 0
        total_energy = np.mean(stft) + 1e-8
        hf_ratio = hf_energy / total_energy

        # MFCC kurtosis — GAN voices often have anomalously high kurtosis
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
        kurt_vals = [kurtosis(mfccs[i]) for i in range(mfccs.shape[0])]
        mean_kurt = float(np.mean(np.abs(kurt_vals)))

        # Spectral periodicity via autocorrelation of spectral centroid
        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        acorr = np.correlate(centroid - centroid.mean(), centroid - centroid.mean(), mode="full")
        acorr = acorr[len(acorr) // 2:]
        if len(acorr) > 50:
            side_lobe = np.max(np.abs(acorr[10:50])) / (np.abs(acorr[0]) + 1e-8)
        else:
            side_lobe = 0.0

        # Score each sub-feature
        score = 0.7  # start neutral

        if hf_ratio < 0.03:
            score -= 0.2  # too little high-freq energy
        elif hf_ratio > 0.15:
            score += 0.1

        if mean_kurt > 15:
            score -= 0.2
        elif mean_kurt < 5:
            score += 0.05

        if side_lobe > 0.7:
            score -= 0.15  # high periodicity = GAN rhythm artefact

        return float(np.clip(score, 0.0, 1.0))
    except Exception:
        return 0.6


def _classify_with_features(y: np.ndarray, sr: int) -> dict:
    """
    Fallback ensemble of engineered features when ML model is unavailable.
    Combines: GAN artifact score, spectral naturalness, and vocal tract plausibility.
    """
    gan_score = _gan_artifact_score(y, sr)

    # Vocal tract filter naturalness — formant bandwidth check
    try:
        lpc_order = 16
        from scipy.signal import lfilter
        # Compute LPC residual energy ratio as formant proxy
        autocorr = np.correlate(y, y, mode="full")[len(y) - 1:]
        autocorr = autocorr[:lpc_order + 1]
        if autocorr[0] > 0:
            r = autocorr[1:] / autocorr[0]
            formant_stability = 1.0 - float(np.std(r[:4]))
        else:
            formant_stability = 0.5
    except Exception:
        formant_stability = 0.5

    # Zero-crossing rate variance (synthetic voices are unnaturally regular)
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    zcr_cv = float(np.std(zcr) / (np.mean(zcr) + 1e-8))
    zcr_score = min(1.0, zcr_cv * 3)  # natural speech CV typically 0.3+

    combined = 0.5 * gan_score + 0.3 * max(0, formant_stability) + 0.2 * zcr_score
    combined = float(np.clip(combined, 0.0, 1.0))
    score = int(combined * 100)

    anomaly = score < 50
    detail = (
        f"Feature ensemble: GAN artifact={gan_score:.2f}, "
        f"formant_stability={formant_stability:.2f}, ZCR_cv={zcr_cv:.2f} "
        f"→ authenticity estimate {score}/100"
    )
    return {
        "score": score,
        "detail": detail,
        "anomaly": anomaly,
        "gan_artifact_score": float(gan_score),
        "zcr_cv": float(zcr_cv),
        "source": "feature_ensemble_fallback",
    }


# ── Public entry point ────────────────────────────────────────────────────────

def run(y: np.ndarray, sr: int) -> dict:
    # Try ML model first
    ml_result = _classify_with_model(y, sr)

    if ml_result is not None:
        classifier_result = ml_result
    else:
        # Fallback to engineered features
        classifier_result = _classify_with_features(y, sr)

    score = classifier_result["score"]
    anomaly = classifier_result["anomaly"]
    status = "PASS" if score >= 70 else ("SUSPICIOUS" if score >= 45 else "FAIL")

    return {
        "layer": "ML Deepfake Classifier",
        "score": score,
        "status": status,
        "anomaly_detected": anomaly,
        "sub_metrics": {
            "deepfake_classifier": classifier_result,
        },
    }