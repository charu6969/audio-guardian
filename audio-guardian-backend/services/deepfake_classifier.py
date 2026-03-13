"""
ML Deepfake Classifier — Layer 6 (Improved)
Uses a pretrained HuggingFace wav2vec2 model fine-tuned on audio deepfake detection.

Primary model: "motheecreator/wav2vec2-Fake-audio-detection"
Fallback:      Enhanced feature-engineering ensemble:
               - GAN artifact detection (high-freq energy, MFCC kurtosis, spectral periodicity)
               - Vocal tract naturalness (formant stability, LPC residual)
               - Zero-crossing regularity analysis
               - Pitch contour naturalness
               - Spectral flux consistency
               - Phase coherence analysis

The improved fallback uses 6 signal dimensions for more accurate deepfake detection
even without the ML model.
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
        print(f"[DeepfakeClassifier] Model unavailable, using enhanced fallback: {e}")
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

    # Use multiple chunks for longer audio (more reliable)
    max_samples = TARGET_SR * 10
    chunks = []
    if len(y) > max_samples:
        # Analyze beginning, middle, and end chunks
        chunk_positions = [
            0,                              # beginning
            (len(y) - max_samples) // 2,    # middle
            max(0, len(y) - max_samples),   # end
        ]
        for start in chunk_positions:
            chunks.append(y[start: start + max_samples])
    else:
        chunks.append(y)

    # Normalise amplitude for each chunk
    real_probs = []
    fake_probs = []

    for chunk in chunks:
        peak = np.max(np.abs(chunk))
        if peak > 0:
            chunk = chunk / peak

        try:
            results = pipe({"array": chunk, "sampling_rate": TARGET_SR})
            label_map = {r["label"].lower(): r["score"] for r in results}

            real_p = label_map.get("real", label_map.get("bonafide", 0.0))
            fake_p = label_map.get("fake", label_map.get("spoof", label_map.get("synthetic", 0.0)))

            total = real_p + fake_p
            if total > 0:
                real_p /= total
                fake_p /= total
            else:
                real_p, fake_p = 0.5, 0.5

            real_probs.append(real_p)
            fake_probs.append(fake_p)
        except Exception:
            continue

    if not real_probs:
        return None  # fallback

    # Average across chunks (more robust for longer audio)
    real_prob = float(np.mean(real_probs))
    fake_prob = float(np.mean(fake_probs))

    # Weighted score: penalize more heavily if ANY chunk is suspicious
    min_real = float(np.min(real_probs))
    score = int(0.7 * real_prob * 100 + 0.3 * min_real * 100)
    score = max(0, min(100, score))

    anomaly = fake_prob > 0.45 or min_real < 0.4
    detail = (
        f"ML model verdict: {'REAL' if real_prob > 0.5 else 'FAKE'} "
        f"(real_prob={real_prob:.2%}, fake_prob={fake_prob:.2%}, "
        f"chunks_analyzed={len(real_probs)}, min_real_chunk={min_real:.2%})"
    )
    return {
        "score": score,
        "detail": detail,
        "anomaly": anomaly,
        "real_probability": real_prob,
        "fake_probability": fake_prob,
        "model": "wav2vec2-Fake-audio-detection",
        "source": "ml_model",
    }


# ── Feature-engineering fallback (IMPROVED) ──────────────────────────────────

def _gan_artifact_score(y: np.ndarray, sr: int) -> float:
    """
    GAN / vocoder artifacts detection:
    - Periodic spectral patterns at harmonic multiples
    - Unnaturally low high-frequency noise
    - Quantisation-like MFCC distribution
    Returns 0.0 (clearly fake) → 1.0 (clearly real)
    """
    try:
        stft = np.abs(librosa.stft(y, n_fft=2048))
        freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)

        # High-frequency energy ratio (above 4 kHz)
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
        score = 0.65

        # HF energy: real speech has moderate HF, fake often has too little or too much
        if hf_ratio < 0.02:
            score -= 0.4   # very little HF = likely synthetic
        elif hf_ratio < 0.05:
            score -= 0.15
        elif hf_ratio > 0.25:
            score -= 0.1   # unnaturally high HF
        else:
            score += 0.1   # healthy HF range

        # Kurtosis: GAN voices have high kurtosis
        if mean_kurt > 20:
            score -= 0.4
        elif mean_kurt > 12:
            score -= 0.25
        elif mean_kurt > 8:
            score -= 0.1
        elif mean_kurt < 5:
            score += 0.05

        # Periodicity: high = GAN
        if side_lobe > 0.7:
            score -= 0.3
        elif side_lobe > 0.5:
            score -= 0.15

        return float(np.clip(score, 0.0, 1.0))
    except Exception:
        return 0.35


def _pitch_naturalness_score(y: np.ndarray, sr: int) -> float:
    """
    Analyze pitch contour naturalness.
    Real speech has smooth but variable pitch; synthetic often has too-regular or choppy pitch.
    Returns 0.0 (unnatural) → 1.0 (natural)
    """
    try:
        f0, voiced_flag, _ = librosa.pyin(
            y, fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            sr=sr
        )
        voiced_f0 = f0[~np.isnan(f0)]

        if len(voiced_f0) < 10:
            return 0.5  # not enough voiced frames

        # Pitch variability (CV) — natural speech ~0.1-0.3
        pitch_cv = float(np.std(voiced_f0) / (np.mean(voiced_f0) + 1e-8))

        # Pitch smoothness — consecutive frame differences
        pitch_diff = np.diff(voiced_f0)
        smoothness = float(np.std(pitch_diff) / (np.mean(np.abs(pitch_diff)) + 1e-8))

        # Voiced ratio — natural speech is ~40-80% voiced
        voiced_ratio = float(np.sum(~np.isnan(f0)) / len(f0))

        score = 0.5

        # CV scoring
        if 0.08 < pitch_cv < 0.35:
            score += 0.2  # natural range
        elif pitch_cv < 0.04:
            score -= 0.25  # too monotone (TTS)
        elif pitch_cv > 0.5:
            score -= 0.15  # too erratic

        # Smoothness scoring
        if smoothness < 2.0:
            score += 0.1
        elif smoothness > 5.0:
            score -= 0.15  # choppy pitch = possible splice

        # Voiced ratio
        if 0.35 < voiced_ratio < 0.85:
            score += 0.1
        elif voiced_ratio > 0.95:
            score -= 0.2  # too much voicing (constant TTS)

        return float(np.clip(score, 0.0, 1.0))
    except Exception:
        return 0.4


def _spectral_flux_consistency(y: np.ndarray, sr: int) -> float:
    """
    Spectral flux consistency across the recording.
    Real speech has natural variation; synthetic may be too uniform.
    Returns 0.0 (suspicious) → 1.0 (natural)
    """
    try:
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        if len(onset_env) < 20:
            return 0.5

        # Coefficient of variation of onset strength
        flux_cv = float(np.std(onset_env) / (np.mean(onset_env) + 1e-8))

        # Natural speech typically has CV ~0.5-1.5
        if 0.4 < flux_cv < 1.8:
            return 0.8
        elif flux_cv < 0.2:
            return 0.3  # too uniform
        elif flux_cv > 3.0:
            return 0.4  # too chaotic
        else:
            return 0.6
    except Exception:
        return 0.5


def _phase_coherence_score(y: np.ndarray, sr: int) -> float:
    """
    Check phase coherence — vocoder artifacts often have unnaturally aligned phases.
    Returns 0.0 (suspicious) → 1.0 (natural)
    """
    try:
        stft_complex = librosa.stft(y, n_fft=2048)
        phase = np.angle(stft_complex)

        # Phase derivative (instantaneous frequency)
        phase_diff = np.diff(phase, axis=1)

        # Wrap to [-pi, pi]
        phase_diff = np.angle(np.exp(1j * phase_diff))

        # Standard deviation of phase derivative — natural speech is noisy,
        # vocoders tend to have more structured phase
        phase_std = float(np.mean(np.std(phase_diff, axis=1)))

        if phase_std > 1.2:
            return 0.8  # naturally noisy phase (good)
        elif phase_std > 0.8:
            return 0.6
        elif phase_std > 0.4:
            return 0.4  # suspiciously structured
        else:
            return 0.25  # very structured = likely vocoder
    except Exception:
        return 0.5


def _classify_with_features(y: np.ndarray, sr: int) -> dict:
    """
    Enhanced fallback ensemble using 6 signal dimensions for deepfake detection.
    """
    gan_score = _gan_artifact_score(y, sr)
    pitch_score = _pitch_naturalness_score(y, sr)
    flux_score = _spectral_flux_consistency(y, sr)
    phase_score = _phase_coherence_score(y, sr)

    # Vocal tract filter naturalness — formant bandwidth check
    try:
        lpc_order = 16
        autocorr = np.correlate(y, y, mode="full")[len(y) - 1:]
        autocorr = autocorr[:lpc_order + 1]
        if autocorr[0] > 0:
            r = autocorr[1:] / autocorr[0]
            formant_stability = 1.0 - float(np.std(r[:4]))
        else:
            formant_stability = 0.5
    except Exception:
        formant_stability = 0.3

    # Zero-crossing rate variance (synthetic voices are unnaturally regular)
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    zcr_cv = float(np.std(zcr) / (np.mean(zcr) + 1e-8))
    zcr_score = min(1.0, zcr_cv * 2.5)  # natural speech CV typically 0.3+

    # Weighted combination of all features
    combined = (
        0.30 * gan_score +          # GAN artifact detection (primary)
        0.20 * pitch_score +        # Pitch naturalness
        0.15 * phase_score +        # Phase coherence
        0.10 * flux_score +         # Spectral flux consistency
        0.15 * max(0, formant_stability) +  # Formant stability
        0.10 * zcr_score            # ZCR regularity
    )

    # Additional penalties for strong synthetic indicators
    if zcr_cv < 0.15:
        combined -= 0.15  # very uniform ZCR = TTS
    if gan_score < 0.3 and pitch_score < 0.4:
        combined -= 0.1  # double evidence of synthetic
    if phase_score < 0.35:
        combined -= 0.1  # vocoder artifact

    combined = float(np.clip(combined, 0.0, 1.0))
    score = int(combined * 100)

    anomaly = score < 50
    status_desc = "REAL" if score >= 60 else "SUSPICIOUS" if score >= 40 else "FAKE"
    detail = (
        f"Enhanced feature analysis ({status_desc}): "
        f"GAN={gan_score:.2f}, pitch={pitch_score:.2f}, "
        f"phase={phase_score:.2f}, flux={flux_score:.2f}, "
        f"formant={formant_stability:.2f}, ZCR_cv={zcr_cv:.2f} "
        f"→ authenticity {score}/100"
    )
    return {
        "score": score,
        "detail": detail,
        "anomaly": anomaly,
        "gan_artifact_score": float(gan_score),
        "pitch_naturalness": float(pitch_score),
        "phase_coherence": float(phase_score),
        "spectral_flux": float(flux_score),
        "formant_stability": float(max(0, formant_stability)),
        "zcr_cv": float(zcr_cv),
        "source": "enhanced_feature_ensemble",
    }


# ── Public entry point ────────────────────────────────────────────────────────

def run(y: np.ndarray, sr: int) -> dict:
    # Try ML model first
    ml_result = _classify_with_model(y, sr)

    if ml_result is not None:
        classifier_result = ml_result
    else:
        # Fallback to enhanced engineered features
        classifier_result = _classify_with_features(y, sr)

    score = classifier_result["score"]
    anomaly = classifier_result["anomaly"]
    status = "PASS" if score >= 65 else ("SUSPICIOUS" if score >= 40 else "FAIL")

    return {
        "layer": "ML Deepfake Classifier",
        "score": score,
        "status": status,
        "anomaly_detected": anomaly,
        "sub_metrics": {
            "deepfake_classifier": classifier_result,
        },
    }