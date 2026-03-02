"""
Environmental Consistency Analysis
- Room Impulse Response (RIR) stability across the file
- Background noise uniformity
- Acoustic signature consistency

Key insight: If audio was spliced from different recordings, the room
acoustic fingerprint will shift at the edit point.
"""

import numpy as np
import librosa
from scipy.signal import correlate


def _get_segments(y: np.ndarray, sr: int, n_segments: int = 8, min_duration_sec: float = 0.5):
    """Split audio into N equal segments for comparison."""
    min_samples = int(min_duration_sec * sr)
    if len(y) < min_samples * n_segments:
        n_segments = max(2, len(y) // min_samples)
    seg_len = len(y) // n_segments
    return [y[i * seg_len:(i + 1) * seg_len] for i in range(n_segments)]


def analyze_room_impulse_response(y: np.ndarray, sr: int) -> dict:
    """
    Estimate room impulse response consistency by comparing spectral
    envelope across segments. A consistent room signature means the
    recording happened in the same acoustic environment throughout.
    """
    try:
        segments = _get_segments(y, sr)
        if len(segments) < 2:
            return {"score": 60, "detail": "Audio too short for RIR analysis", "anomaly": False}

        # Compute spectral centroid per segment as acoustic fingerprint proxy
        centroids = []
        for seg in segments:
            if np.max(np.abs(seg)) < 0.001:  # skip silent segments
                continue
            c = librosa.feature.spectral_centroid(y=seg, sr=sr)[0]
            centroids.append(float(np.mean(c)))

        if len(centroids) < 2:
            return {"score": 60, "detail": "Insufficient non-silent segments", "anomaly": False}

        centroid_std = float(np.std(centroids))
        centroid_mean = float(np.mean(centroids))
        cv = centroid_std / (centroid_mean + 1e-8)  # coefficient of variation

        # Also compare MFCCs across segments for a deeper fingerprint
        mfcc_means = []
        for seg in segments:
            if np.max(np.abs(seg)) < 0.001:
                continue
            m = librosa.feature.mfcc(y=seg, sr=sr, n_mfcc=13)
            mfcc_means.append(np.mean(m, axis=1))

        if len(mfcc_means) >= 2:
            # Compute pairwise cosine similarity
            similarities = []
            for i in range(len(mfcc_means) - 1):
                a, b = mfcc_means[i], mfcc_means[i + 1]
                sim = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8)
                similarities.append(float(sim))
            mean_sim = float(np.mean(similarities))
            min_sim = float(np.min(similarities))
        else:
            mean_sim = 0.9
            min_sim = 0.9

        score = 80
        issues = []
        anomaly = False

        if cv > 0.3:
            score -= 30
            anomaly = True
            issues.append(f"High spectral centroid variation — room acoustic shift detected (CV={cv:.2f})")
        elif cv > 0.15:
            score -= 10
            issues.append(f"Moderate acoustic variation (CV={cv:.2f})")
        else:
            issues.append(f"Consistent room acoustics (CV={cv:.2f})")

        if min_sim < 0.7:
            score -= 25
            anomaly = True
            issues.append(f"MFCC fingerprint mismatch at segment boundary — possible splice (min_sim={min_sim:.2f})")
        elif min_sim < 0.85:
            score -= 10
            issues.append(f"Minor acoustic variation (MFCC sim={min_sim:.2f})")
        else:
            issues.append(f"Consistent acoustic fingerprint throughout (MFCC sim={mean_sim:.2f})")

        score = max(0, min(100, score))
        return {
            "score": score,
            "detail": "; ".join(issues),
            "anomaly": anomaly,
            "centroid_cv": float(cv),
            "mfcc_min_similarity": float(min_sim),
        }

    except Exception as e:
        return {"score": 50, "detail": f"RIR analysis failed: {str(e)}", "anomaly": False}


def analyze_background_noise_uniformity(y: np.ndarray, sr: int) -> dict:
    """
    Analyze noise floor consistency across the file.
    Spliced audio often has abrupt noise floor changes at edit points.
    """
    try:
        # Use RMS energy in silence regions to estimate noise floor
        frame_length = int(0.1 * sr)   # 100ms frames
        hop_length = int(0.05 * sr)    # 50ms hop
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]

        # Identify noise floor frames (bottom 20th percentile of energy)
        threshold = np.percentile(rms, 20)
        noise_frames = rms[rms <= threshold * 2]

        if len(noise_frames) < 5:
            return {"score": 70, "detail": "Insufficient silence for noise floor analysis", "anomaly": False}

        noise_std = float(np.std(noise_frames))
        noise_mean = float(np.mean(noise_frames))
        noise_cv = noise_std / (noise_mean + 1e-10)

        # Look for abrupt jumps in noise floor (splice indicators)
        rms_diff = np.abs(np.diff(rms))
        jump_threshold = np.mean(rms_diff) + 3 * np.std(rms_diff)
        n_jumps = int(np.sum(rms_diff > jump_threshold))

        score = 85
        issues = []
        anomaly = False

        if noise_cv > 0.5:
            score -= 25
            anomaly = True
            issues.append(f"Highly variable noise floor — recording inconsistency (CV={noise_cv:.2f})")
        else:
            issues.append(f"Uniform noise floor (CV={noise_cv:.2f})")

        if n_jumps > 3:
            score -= 20
            anomaly = True
            issues.append(f"{n_jumps} abrupt energy transitions detected — possible edit points")
        elif n_jumps > 1:
            score -= 5
            issues.append(f"{n_jumps} minor energy transitions (within normal range)")
        else:
            issues.append("No abrupt energy transitions detected")

        score = max(0, min(100, score))
        return {
            "score": score,
            "detail": "; ".join(issues),
            "anomaly": anomaly,
            "noise_cv": float(noise_cv),
            "abrupt_transitions": n_jumps,
        }

    except Exception as e:
        return {"score": 50, "detail": f"Noise uniformity analysis failed: {str(e)}", "anomaly": False}


def analyze_acoustic_signature(y: np.ndarray, sr: int) -> dict:
    """
    Compare the acoustic signature (reverb tail, frequency response)
    between the beginning and end of the recording.
    """
    try:
        duration = len(y) / sr
        if duration < 1.0:
            return {"score": 70, "detail": "Audio too short for acoustic signature comparison", "anomaly": False}

        # Take first and last 20% of audio for comparison
        chunk = int(len(y) * 0.2)
        start = y[:chunk]
        end = y[-chunk:]

        # Compare chroma features as a room-agnostic acoustic signature
        chroma_start = librosa.feature.chroma_stft(y=start, sr=sr)
        chroma_end = librosa.feature.chroma_stft(y=end, sr=sr)

        mean_start = np.mean(chroma_start, axis=1)
        mean_end = np.mean(chroma_end, axis=1)

        # Cosine similarity between start and end signatures
        similarity = float(np.dot(mean_start, mean_end) /
                           (np.linalg.norm(mean_start) * np.linalg.norm(mean_end) + 1e-8))

        score = int(similarity * 100)
        anomaly = similarity < 0.65

        if anomaly:
            detail = f"Acoustic signature mismatch between start and end (similarity={similarity:.2f}) — possible environment change or splice"
        else:
            detail = f"Consistent acoustic signature throughout (similarity={similarity:.2f})"

        return {"score": score, "detail": detail, "anomaly": anomaly, "signature_similarity": similarity}

    except Exception as e:
        return {"score": 50, "detail": f"Acoustic signature analysis failed: {str(e)}", "anomaly": False}


def run(y: np.ndarray, sr: int) -> dict:
    rir = analyze_room_impulse_response(y, sr)
    noise = analyze_background_noise_uniformity(y, sr)
    signature = analyze_acoustic_signature(y, sr)

    overall = int(rir["score"] * 0.45 + noise["score"] * 0.35 + signature["score"] * 0.20)
    any_anomaly = rir["anomaly"] or noise["anomaly"] or signature["anomaly"]
    status = "PASS" if overall >= 70 else ("SUSPICIOUS" if overall >= 45 else "FAIL")

    return {
        "layer": "Environmental Consistency",
        "score": overall,
        "status": status,
        "anomaly_detected": any_anomaly,
        "sub_metrics": {
            "room_impulse_response": rir,
            "background_noise_uniformity": noise,
            "acoustic_signature": signature,
        },
    }