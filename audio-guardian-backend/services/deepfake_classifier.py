"""
ML Deepfake Classifier — Layer 6 (Recalibrated for Modern AI TTS)

Modern AI-generated speech (ElevenLabs, Bark, XTTS, etc.) produces audio that is
acoustically almost identical to real speech at the macro level. Basic checks like
HF energy, pitch CV, and spectral flux will ALL pass because modern vocoders are
that good.

To catch modern deepfakes, we need to look at:
1. MFCC delta smoothness — AI speech has unnaturally smooth MFCC transitions
2. Micro-jitter in pitch — Real speech has irregular micro-variations; AI is too smooth
3. Spectral bandwidth variance — AI voices have less natural bandwidth variation
4. Harmonic regularity — AI voices have too-perfect harmonics
5. Frame-level energy micro-variance — AI normalizes energy too uniformly
6. Silence/breathing naturalness — AI pauses are too clean
7. Sub-band correlation — AI has unnaturally high correlation between frequency bands
8. Long-term spectral flatness patterns

This classifier is SKEPTICAL BY DEFAULT — audio must prove it's real, not the other way.
"""

import numpy as np
import librosa
from scipy.stats import kurtosis, skew
import warnings

warnings.filterwarnings("ignore")


def _mfcc_smoothness_score(y: np.ndarray, sr: int) -> float:
    """
    AI-generated speech has unnaturally smooth MFCC delta transitions.
    Real speech has irregular, jagged MFCC deltas.
    Returns: low = likely synthetic, high = likely real
    """
    try:
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
        delta = librosa.feature.delta(mfccs)
        delta2 = librosa.feature.delta(mfccs, order=2)

        # Measure roughness of delta MFCCs (real speech is rougher)
        delta_roughness = float(np.mean(np.std(delta, axis=1)))
        delta2_roughness = float(np.mean(np.std(delta2, axis=1)))

        # Kurtosis of delta — AI tends to have lower kurtosis (more gaussian)
        delta_kurt = float(np.mean([kurtosis(delta[i]) for i in range(delta.shape[0])]))

        # Real speech: roughness > 8, kurt > 3
        # AI speech: roughness 3-7, kurt 0-2
        score = 0.3  # skeptical baseline

        if delta_roughness > 12:
            score += 0.35
        elif delta_roughness > 8:
            score += 0.20
        elif delta_roughness > 5:
            score += 0.05
        # else: stays low (smooth = AI)

        if delta2_roughness > 6:
            score += 0.15
        elif delta2_roughness > 3:
            score += 0.05

        if delta_kurt > 5:
            score += 0.15
        elif delta_kurt > 2:
            score += 0.05
        elif delta_kurt < 0.5:
            score -= 0.10  # too gaussian = AI

        return float(np.clip(score, 0.0, 1.0))
    except Exception:
        return 0.25


def _pitch_micro_jitter(y: np.ndarray, sr: int) -> float:
    """
    Real speech has irregular micro-jitter in F0 contour.
    AI speech is too smooth even with prosody modeling.
    """
    try:
        f0, _, _ = librosa.pyin(
            y, fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            sr=sr
        )
        voiced_f0 = f0[~np.isnan(f0)]

        if len(voiced_f0) < 15:
            return 0.30

        # Frame-to-frame jitter (irregularity)
        diffs = np.abs(np.diff(voiced_f0))
        mean_diff = float(np.mean(diffs))
        std_diff = float(np.std(diffs))
        jitter_ratio = std_diff / (mean_diff + 1e-8)

        # Shimmer-like measure on pitch
        relative_perturbation = float(np.mean(diffs / (voiced_f0[:-1] + 1e-8)))

        # Second-order jitter (jitter of jitter)
        if len(diffs) > 5:
            jitter_of_jitter = float(np.std(np.diff(diffs)))
        else:
            jitter_of_jitter = 0

        score = 0.25  # skeptical default

        # Real speech typically: jitter_ratio > 1.2, relative_perturbation > 0.02
        # AI speech: jitter_ratio 0.5-1.0, relative_perturbation < 0.015
        if jitter_ratio > 1.5:
            score += 0.30
        elif jitter_ratio > 1.0:
            score += 0.15
        elif jitter_ratio < 0.6:
            score -= 0.10  # too smooth

        if relative_perturbation > 0.03:
            score += 0.20
        elif relative_perturbation > 0.015:
            score += 0.10
        elif relative_perturbation < 0.008:
            score -= 0.10  # too stable = AI

        if jitter_of_jitter > 3.0:
            score += 0.15
        elif jitter_of_jitter > 1.5:
            score += 0.05

        return float(np.clip(score, 0.0, 1.0))
    except Exception:
        return 0.25


def _spectral_bandwidth_variance(y: np.ndarray, sr: int) -> float:
    """
    Natural speech has high variance in spectral bandwidth over time.
    AI speech tends to be more uniform.
    """
    try:
        bw = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
        bw_cv = float(np.std(bw) / (np.mean(bw) + 1e-8))

        # Also check skewness of bandwidth distribution
        bw_skew = float(skew(bw))

        score = 0.30

        # Real speech: bw_cv > 0.25
        # AI: bw_cv 0.10-0.20
        if bw_cv > 0.35:
            score += 0.35
        elif bw_cv > 0.25:
            score += 0.20
        elif bw_cv > 0.15:
            score += 0.05
        # else: too uniform = AI

        # Real speech has positive skew typically
        if abs(bw_skew) > 0.8:
            score += 0.15
        elif abs(bw_skew) > 0.3:
            score += 0.05

        return float(np.clip(score, 0.0, 1.0))
    except Exception:
        return 0.25


def _harmonic_regularity(y: np.ndarray, sr: int) -> float:
    """
    AI voices produce too-perfect harmonics.
    Real speech has natural harmonic imperfections.
    """
    try:
        harmonic, percussive = librosa.effects.hpss(y)
        h_ratio = float(np.mean(np.abs(harmonic)) / (np.mean(np.abs(y)) + 1e-8))

        # Spectral flatness — AI speech often has less flat spectrum (more tonal)
        flatness = librosa.feature.spectral_flatness(y=y)[0]
        mean_flatness = float(np.mean(flatness))
        flatness_var = float(np.std(flatness) / (mean_flatness + 1e-8))

        # Harmonic energy consistency across frames
        h_energy = np.abs(librosa.stft(harmonic))
        h_frame_energy = np.mean(h_energy, axis=0)
        h_consistency = float(np.std(h_frame_energy) / (np.mean(h_frame_energy) + 1e-8))

        score = 0.30

        # Real speech: h_ratio 0.5-0.75, flatness_var > 0.5
        # AI: h_ratio > 0.8 (too harmonic), flatness_var < 0.3
        if h_ratio > 0.85:
            score -= 0.15  # too harmonically pure = AI
        elif h_ratio < 0.65:
            score += 0.15  # natural mix of harmonic/noise

        if flatness_var > 0.8:
            score += 0.25
        elif flatness_var > 0.4:
            score += 0.10
        elif flatness_var < 0.2:
            score -= 0.10  # too uniform = AI

        if h_consistency > 0.6:
            score += 0.15
        elif h_consistency < 0.3:
            score -= 0.05

        return float(np.clip(score, 0.0, 1.0))
    except Exception:
        return 0.25


def _energy_micro_variance(y: np.ndarray, sr: int) -> float:
    """
    AI normalizes energy too uniformly. Real speech has natural
    micro-fluctuations in frame energy.
    """
    try:
        rms = librosa.feature.rms(y=y, frame_length=512, hop_length=128)[0]

        if len(rms) < 30:
            return 0.30

        # Micro-variance: look at very short-term energy changes
        rms_diff = np.diff(rms)
        micro_var = float(np.std(rms_diff) / (np.mean(np.abs(rms_diff)) + 1e-8))

        # Dynamic range in small windows
        window_size = min(50, len(rms) // 4)
        if window_size > 5:
            local_ranges = []
            for i in range(0, len(rms) - window_size, window_size // 2):
                window = rms[i:i + window_size]
                local_ranges.append(float(np.max(window) - np.min(window)))
            range_var = float(np.std(local_ranges) / (np.mean(local_ranges) + 1e-8))
        else:
            range_var = 0.5

        score = 0.25

        # Real speech: micro_var > 1.3, range_var > 0.5
        # AI: micro_var 0.8-1.1, range_var < 0.4
        if micro_var > 1.5:
            score += 0.30
        elif micro_var > 1.2:
            score += 0.15
        elif micro_var < 0.9:
            score -= 0.10  # too smooth

        if range_var > 0.7:
            score += 0.25
        elif range_var > 0.4:
            score += 0.10
        elif range_var < 0.25:
            score -= 0.10

        return float(np.clip(score, 0.0, 1.0))
    except Exception:
        return 0.25


def _silence_naturalness(y: np.ndarray, sr: int) -> float:
    """
    AI-generated audio has unnaturally clean silences/pauses.
    Real recordings have ambient noise, breathing, mouth sounds.
    """
    try:
        rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=256)[0]
        threshold = float(np.median(rms) * 0.15)

        # Find silent frames
        silent_frames = rms < threshold
        n_silent = int(np.sum(silent_frames))

        if n_silent < 5:
            return 0.40  # no significant silences to analyze

        # Energy in "silent" regions — real recordings have ambient noise
        silent_energies = rms[silent_frames]
        silent_var = float(np.std(silent_energies) / (np.mean(silent_energies) + 1e-8))

        # In real recordings, silence has variable low-level noise
        # In AI, silence is either dead silent or perfectly uniform
        score = 0.30

        if silent_var > 0.8:
            score += 0.35  # naturally varied ambient noise
        elif silent_var > 0.4:
            score += 0.15
        elif silent_var < 0.15:
            score -= 0.15  # too uniform silence = AI

        # Check silence-to-speech transitions
        transitions = np.diff(silent_frames.astype(int))
        n_transitions = int(np.sum(np.abs(transitions)))
        if n_transitions > 6:
            score += 0.10  # natural speech has many transitions

        return float(np.clip(score, 0.0, 1.0))
    except Exception:
        return 0.25


def _subband_correlation(y: np.ndarray, sr: int) -> float:
    """
    AI speech often has unnaturally high correlation between frequency sub-bands.
    Real speech has more independent sub-band behavior.
    """
    try:
        S = np.abs(librosa.stft(y, n_fft=2048))
        n_bins = S.shape[0]

        # Split into 4 sub-bands
        band_size = n_bins // 4
        bands = [np.mean(S[i * band_size:(i + 1) * band_size, :], axis=0) for i in range(4)]

        # Compute pairwise correlations
        correlations = []
        for i in range(4):
            for j in range(i + 1, 4):
                if len(bands[i]) > 0 and len(bands[j]) > 0:
                    corr = float(np.corrcoef(bands[i], bands[j])[0, 1])
                    if not np.isnan(corr):
                        correlations.append(abs(corr))

        if not correlations:
            return 0.30

        mean_corr = float(np.mean(correlations))

        score = 0.30

        # Real speech: mean_corr 0.3-0.6 (bands are somewhat independent)
        # AI: mean_corr > 0.7 (bands are highly correlated due to vocoder)
        if mean_corr < 0.4:
            score += 0.35  # good independence between bands
        elif mean_corr < 0.55:
            score += 0.20
        elif mean_corr < 0.7:
            score += 0.05
        elif mean_corr > 0.85:
            score -= 0.15  # very high correlation = likely AI

        return float(np.clip(score, 0.0, 1.0))
    except Exception:
        return 0.25


def _classify(y: np.ndarray, sr: int) -> dict:
    """
    8-dimension deepfake classifier. Skeptical by default.
    """
    # Optimization: analyze up to first 15 seconds to ensure instant speed
    max_samples = sr * 15
    if len(y) > max_samples:
        y = y[:max_samples]

    mfcc_sm = _mfcc_smoothness_score(y, sr)
    pitch_jit = _pitch_micro_jitter(y, sr)
    bw_var = _spectral_bandwidth_variance(y, sr)
    harm_reg = _harmonic_regularity(y, sr)
    energy_mv = _energy_micro_variance(y, sr)
    silence_nat = _silence_naturalness(y, sr)
    subband_corr = _subband_correlation(y, sr)

    # ZCR coefficient of variation
    try:
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        zcr_cv = float(np.std(zcr) / (np.mean(zcr) + 1e-8))
        zcr_score = min(1.0, max(0.0, (zcr_cv - 0.15) * 2.0))  # centered around 0.15-0.65
    except Exception:
        zcr_cv = 0.3
        zcr_score = 0.3

    # Weighted combination — each feature is already skeptical (baseline ~0.25-0.30)
    combined = (
        0.20 * mfcc_sm +         # MFCC smoothness (most discriminative)
        0.18 * pitch_jit +        # Pitch micro-jitter
        0.15 * bw_var +           # Bandwidth variance
        0.12 * harm_reg +         # Harmonic regularity
        0.12 * energy_mv +        # Energy micro-variance
        0.10 * silence_nat +      # Silence naturalness
        0.08 * subband_corr +     # Sub-band correlation
        0.05 * zcr_score          # ZCR variance
    )

    # Compound penalties: if multiple features suggest synthetic
    n_low = sum(1 for s in [mfcc_sm, pitch_jit, bw_var, harm_reg, energy_mv]
                if s < 0.35)
    if n_low >= 3:
        combined -= 0.10  # multiple synthetic indicators
    if n_low >= 4:
        combined -= 0.10  # very likely synthetic

    # If MFCC smoothness AND pitch jitter both low → strong AI signal
    if mfcc_sm < 0.35 and pitch_jit < 0.35:
        combined -= 0.08

    # Exceptionally suspicious MFCC smoothness (hallmark of modern TTS models like ElevenLabs)
    if mfcc_sm <= 0.25:
        combined -= 0.30
        combined = min(combined, 0.38)  # Cap max score so it fails heavily

    # Exceptionally uniform energy microvariance
    if energy_mv <= 0.25:
        combined -= 0.15

    combined = float(np.clip(combined, 0.0, 1.0))
    score = int(combined * 100)

    anomaly = score < 55
    if score >= 60:
        status_desc = "LIKELY REAL"
    elif score >= 45:
        status_desc = "SUSPICIOUS"
    elif score >= 30:
        status_desc = "LIKELY SYNTHETIC"
    else:
        status_desc = "SYNTHETIC"

    detail = (
        f"Deepfake analysis ({status_desc}): "
        f"MFCC_smooth={mfcc_sm:.2f}, pitch_jitter={pitch_jit:.2f}, "
        f"BW_var={bw_var:.2f}, harmonic={harm_reg:.2f}, "
        f"energy_mv={energy_mv:.2f}, silence={silence_nat:.2f}, "
        f"subband={subband_corr:.2f}, ZCR_cv={zcr_cv:.2f} "
        f"→ authenticity {score}/100"
    )

    return {
        "score": score,
        "detail": detail,
        "anomaly": anomaly,
        "mfcc_smoothness": float(mfcc_sm),
        "pitch_micro_jitter": float(pitch_jit),
        "bandwidth_variance": float(bw_var),
        "harmonic_regularity": float(harm_reg),
        "energy_micro_variance": float(energy_mv),
        "silence_naturalness": float(silence_nat),
        "subband_correlation": float(subband_corr),
        "zcr_cv": float(zcr_cv),
        "source": "deepfake_feature_ensemble_v2",
    }


# ── Public entry point ────────────────────────────────────────────────────────

def run(y: np.ndarray, sr: int) -> dict:
    classifier_result = _classify(y, sr)

    score = classifier_result["score"]
    anomaly = classifier_result["anomaly"]
    status = "PASS" if score >= 60 else ("SUSPICIOUS" if score >= 40 else "FAIL")

    return {
        "layer": "ML Deepfake Classifier",
        "score": score,
        "status": status,
        "anomaly_detected": anomaly,
        "sub_metrics": {
            "deepfake_classifier": classifier_result,
        },
    }