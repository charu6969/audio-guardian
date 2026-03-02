"""
Temporal Coherence Analysis
- Breathing pattern naturalness
- Pause distribution (humans have characteristic pause patterns)
- Prosody naturalness (rhythm and stress patterns)
"""

import numpy as np
import librosa
from scipy.stats import entropy


def analyze_breathing_patterns(y: np.ndarray, sr: int) -> dict:
    """
    Detect breathing patterns. Real human speech contains inhalation
    sounds at natural intervals (typically every 5–15 seconds).
    TTS often lacks these or places them unnaturally.
    """
    try:
        # Analyze energy envelope for breath-like bursts
        frame_length = int(0.05 * sr)  # 50ms
        hop_length = int(0.025 * sr)   # 25ms
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]

        duration = len(y) / sr
        times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop_length)

        # Identify low-energy regions (potential breath points)
        energy_threshold = np.percentile(rms, 25)
        low_energy_mask = rms < energy_threshold

        # Find transitions into low-energy (potential breath starts)
        transitions = np.diff(low_energy_mask.astype(int))
        breath_starts = np.where(transitions == 1)[0]
        breath_times = times[breath_starts] if len(breath_starts) > 0 else np.array([])

        score = 75
        issues = []
        anomaly = False

        if duration < 2.0:
            return {"score": 70, "detail": "Audio too short for breathing analysis", "anomaly": False}

        if len(breath_times) == 0:
            score = 50
            anomaly = True
            issues.append("No breath-like pauses detected — unnaturally continuous speech")
        else:
            # Calculate intervals between breath points
            if len(breath_times) > 1:
                intervals = np.diff(breath_times)
                mean_interval = float(np.mean(intervals))

                # Natural breathing: 5–20 second intervals during speech
                if 3.0 <= mean_interval <= 25.0:
                    score = 85
                    issues.append(f"Natural breath intervals detected (avg {mean_interval:.1f}s)")
                elif mean_interval < 3.0:
                    score = 60
                    issues.append(f"Very frequent pauses (avg {mean_interval:.1f}s) — may be choppy synthesis")
                else:
                    score = 70
                    issues.append(f"Infrequent pauses (avg {mean_interval:.1f}s)")
            else:
                score = 70
                issues.append(f"Single breath-like pause detected at {breath_times[0]:.1f}s")

        score = max(0, min(100, score))
        return {
            "score": score,
            "detail": "; ".join(issues),
            "anomaly": anomaly,
            "breath_count": len(breath_times),
        }

    except Exception as e:
        return {"score": 50, "detail": f"Breathing analysis failed: {str(e)}", "anomaly": False}


def analyze_pause_distribution(y: np.ndarray, sr: int) -> dict:
    """
    Analyze pause distribution for naturalness.
    Human speech pauses follow a roughly log-normal distribution.
    TTS often produces uniformly distributed or structurally rigid pauses.
    """
    try:
        frame_length = int(0.02 * sr)
        hop_length = int(0.01 * sr)
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]

        # Identify silence (below 5th percentile of energy)
        silence_threshold = np.percentile(rms, 5) * 3
        is_silence = rms < silence_threshold

        # Find silence runs
        silence_runs = []
        in_silence = False
        start = 0
        for i, s in enumerate(is_silence):
            if s and not in_silence:
                in_silence = True
                start = i
            elif not s and in_silence:
                in_silence = False
                run_len = (i - start) * hop_length / sr
                if run_len > 0.05:  # only count pauses > 50ms
                    silence_runs.append(run_len)

        if len(silence_runs) < 3:
            return {"score": 65, "detail": "Too few pauses to analyze distribution", "anomaly": False}

        pause_lengths = np.array(silence_runs)
        mean_pause = float(np.mean(pause_lengths))
        std_pause = float(np.std(pause_lengths))
        cv_pause = std_pause / (mean_pause + 1e-8)

        # Compute entropy of pause length histogram (natural speech = higher entropy)
        hist, _ = np.histogram(pause_lengths, bins=min(10, len(pause_lengths)))
        hist_prob = (hist + 1e-8) / (hist.sum() + 1e-8)
        pause_entropy = float(entropy(hist_prob))

        score = 75
        issues = []
        anomaly = False

        # Natural speech has varied pause lengths (moderate-high CV)
        if cv_pause < 0.3:
            score -= 20
            anomaly = True
            issues.append(f"Suspiciously uniform pause lengths (CV={cv_pause:.2f}) — possible TTS")
        else:
            issues.append(f"Natural pause variability (CV={cv_pause:.2f})")

        if pause_entropy < 0.8:
            score -= 15
            anomaly = True
            issues.append(f"Low pause entropy — rigid speech rhythm detected ({pause_entropy:.2f})")
        else:
            issues.append(f"Natural pause entropy ({pause_entropy:.2f})")

        issues.append(f"{len(pause_lengths)} pauses found, avg {mean_pause:.2f}s")

        score = max(0, min(100, score))
        return {
            "score": score,
            "detail": "; ".join(issues),
            "anomaly": anomaly,
            "pause_count": len(pause_lengths),
            "pause_cv": float(cv_pause),
        }

    except Exception as e:
        return {"score": 50, "detail": f"Pause distribution analysis failed: {str(e)}", "anomaly": False}


def analyze_prosody_naturalness(y: np.ndarray, sr: int) -> dict:
    """
    Analyze prosody (pitch contour, rhythm, stress patterns).
    Natural speech has smooth, contextually appropriate F0 contours.
    TTS often has flat, monotone or overly-melodic prosody.
    """
    try:
        # Extract F0 contour
        f0, voiced_flag, _ = librosa.pyin(
            y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7")
        )
        voiced_f0 = f0[voiced_flag]
        voiced_f0 = voiced_f0[~np.isnan(voiced_f0)]

        if len(voiced_f0) < 20:
            return {"score": 60, "detail": "Insufficient voiced frames for prosody analysis", "anomaly": False}

        # Measure pitch range (natural speech spans 1–2 octaves)
        f0_range = float(np.max(voiced_f0) - np.min(voiced_f0))
        f0_mean = float(np.mean(voiced_f0))
        range_in_semitones = 12 * np.log2((f0_mean + f0_range / 2) / (f0_mean - f0_range / 2 + 1e-8))

        # Measure pitch contour smoothness
        f0_diff = np.diff(voiced_f0)
        f0_accel = np.diff(f0_diff)
        pitch_smoothness = float(np.mean(np.abs(f0_accel)))

        score = 75
        issues = []
        anomaly = False

        # Natural speech typically spans 8–20 semitones in a sentence
        if range_in_semitones < 3:
            score -= 25
            anomaly = True
            issues.append(f"Monotone pitch range — only {range_in_semitones:.1f} semitones")
        elif range_in_semitones > 30:
            score -= 10
            issues.append(f"Very wide pitch range — possibly exaggerated synthesis ({range_in_semitones:.1f} st)")
        else:
            issues.append(f"Natural pitch range ({range_in_semitones:.1f} semitones)")

        # Pitch acceleration tells us about prosodic naturalness
        if pitch_smoothness < 0.5:
            score -= 15
            anomaly = True
            issues.append(f"Unusually smooth F0 trajectory — robotic prosody detected")
        else:
            issues.append(f"Natural prosodic variation detected (accel={pitch_smoothness:.1f} Hz²)")

        score = max(0, min(100, score))
        return {
            "score": score,
            "detail": "; ".join(issues),
            "anomaly": anomaly,
            "pitch_range_semitones": float(range_in_semitones),
            "mean_f0_hz": float(f0_mean),
        }

    except Exception as e:
        return {"score": 50, "detail": f"Prosody analysis failed: {str(e)}", "anomaly": False}


def run(y: np.ndarray, sr: int) -> dict:
    breathing = analyze_breathing_patterns(y, sr)
    pause = analyze_pause_distribution(y, sr)
    prosody = analyze_prosody_naturalness(y, sr)

    overall = int(breathing["score"] * 0.30 + pause["score"] * 0.35 + prosody["score"] * 0.35)
    any_anomaly = breathing["anomaly"] or pause["anomaly"] or prosody["anomaly"]
    status = "PASS" if overall >= 70 else ("SUSPICIOUS" if overall >= 45 else "FAIL")

    return {
        "layer": "Temporal Coherence",
        "score": overall,
        "status": status,
        "anomaly_detected": any_anomaly,
        "sub_metrics": {
            "breathing_patterns": breathing,
            "pause_distribution": pause,
            "prosody_naturalness": prosody,
        },
    }