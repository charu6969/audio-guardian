"""
Cross-Modal Fingerprint Analysis (Splice Detector)
- Noise floor consistency
- Splice point detection via spectral discontinuity
- Dynamic range integrity
"""

import numpy as np
import librosa
from scipy.stats import zscore


def analyze_noise_floor_consistency(y: np.ndarray, sr: int) -> dict:
    """
    The noise floor is one of the hardest things to fake when splicing audio.
    Different recording environments, microphones, or TTS outputs have
    distinct noise floor characteristics. Any change = possible splice.
    """
    try:
        # Divide audio into short windows and measure noise floor per window
        window_sec = 0.5
        window_samples = int(window_sec * sr)
        hop_samples = window_samples // 2

        if len(y) < window_samples * 4:
            return {"score": 70, "detail": "Audio too short for noise floor analysis", "anomaly": False}

        noise_floors = []
        for i in range(0, len(y) - window_samples, hop_samples):
            window = y[i:i + window_samples]
            # Noise floor = 5th percentile of absolute amplitude in window
            nf = float(np.percentile(np.abs(window), 5))
            noise_floors.append(nf)

        noise_floors = np.array(noise_floors)

        # Normalize and compute Z-scores to detect outliers
        if np.std(noise_floors) < 1e-10:
            return {"score": 50, "detail": "Suspiciously constant noise floor (digital silence?)", "anomaly": True}

        z_scores = np.abs(zscore(noise_floors))
        n_outliers = int(np.sum(z_scores > 3.0))

        # Compute overall variability
        cv = float(np.std(noise_floors) / (np.mean(noise_floors) + 1e-10))

        score = 85
        issues = []
        anomaly = False

        if n_outliers > 2:
            score -= 30
            anomaly = True
            issues.append(f"{n_outliers} noise floor anomalies detected — possible splice points")
        else:
            issues.append("Consistent noise floor throughout recording")

        if cv > 0.8:
            score -= 20
            anomaly = True
            issues.append(f"High noise floor variability (CV={cv:.2f}) — environment change suspected")
        elif cv < 0.001:
            score -= 15
            anomaly = True
            issues.append(f"Perfect noise floor — possible digital/TTS origin (CV={cv:.4f})")
        else:
            issues.append(f"Natural noise floor variation (CV={cv:.2f})")

        score = max(0, min(100, score))
        return {
            "score": score,
            "detail": "; ".join(issues),
            "anomaly": anomaly,
            "noise_outliers": n_outliers,
            "noise_cv": float(cv),
        }

    except Exception as e:
        return {"score": 50, "detail": f"Noise floor analysis failed: {str(e)}", "anomaly": False}


def detect_splices(y: np.ndarray, sr: int) -> dict:
    """
    Detect splice points using spectral flux discontinuity.
    A splice creates an abrupt spectral change that doesn't match
    natural speech dynamics.
    """
    try:
        # Compute spectral flux (frame-to-frame spectral change)
        stft = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
        spectral_flux = np.sqrt(np.sum(np.diff(stft, axis=1) ** 2, axis=0))

        # Adaptive threshold: mean + N*std
        mean_flux = float(np.mean(spectral_flux))
        std_flux = float(np.std(spectral_flux))
        threshold = mean_flux + 4.0 * std_flux

        # Find peaks in spectral flux above threshold
        from scipy.signal import find_peaks
        peaks, properties = find_peaks(spectral_flux, height=threshold, distance=sr // 512)

        # Convert peak frame indices to timestamps
        peak_times = [float(librosa.frames_to_time(p, sr=sr, hop_length=512)) for p in peaks]

        duration = len(y) / sr
        score = 90
        issues = []
        anomaly = False

        if len(peaks) == 0:
            issues.append("No spectral discontinuities detected")
        elif len(peaks) <= 2:
            score -= 10
            issues.append(f"{len(peaks)} minor spectral discontinuity detected — within natural range")
        else:
            score -= 15 * min(len(peaks), 5)
            anomaly = True
            timestamp_str = ", ".join([f"{t:.1f}s" for t in peak_times[:5]])
            issues.append(f"{len(peaks)} splice-like spectral discontinuities at: {timestamp_str}")

        score = max(0, min(100, score))
        return {
            "score": score,
            "detail": "; ".join(issues) if issues else "Clean spectral profile",
            "anomaly": anomaly,
            "splice_candidates": len(peaks),
            "splice_timestamps": peak_times[:10],  # limit to 10
        }

    except Exception as e:
        return {"score": 50, "detail": f"Splice detection failed: {str(e)}", "anomaly": False}


def analyze_dynamic_range(y: np.ndarray, sr: int) -> dict:
    """
    Analyze dynamic range integrity.
    Natural speech has a characteristic dynamic range and crest factor.
    Over-compressed audio (common in TTS pipelines) shows abnormally
    uniform amplitude (brickwalled).
    """
    try:
        # Crest factor: peak to RMS ratio
        rms = float(np.sqrt(np.mean(y ** 2)))
        peak = float(np.max(np.abs(y)))

        if rms < 1e-6:
            return {"score": 40, "detail": "Nearly silent audio — cannot assess dynamic range", "anomaly": True}

        crest_factor_db = float(20 * np.log10(peak / (rms + 1e-8)))

        # Compute dynamic range per segment
        frame_length = int(0.1 * sr)
        hop_length = int(0.05 * sr)
        rms_frames = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
        rms_frames_nz = rms_frames[rms_frames > 0.001]

        if len(rms_frames_nz) < 5:
            return {"score": 60, "detail": "Insufficient voiced frames", "anomaly": False}

        dynamic_range_db = float(20 * np.log10(
            np.max(rms_frames_nz) / (np.min(rms_frames_nz) + 1e-8)
        ))

        score = 80
        issues = []
        anomaly = False

        # Natural speech crest factor: typically 10–20 dB
        if crest_factor_db < 6:
            score -= 25
            anomaly = True
            issues.append(f"Low crest factor ({crest_factor_db:.1f} dB) — over-compressed/brickwalled audio")
        elif crest_factor_db > 30:
            score -= 10
            issues.append(f"High crest factor ({crest_factor_db:.1f} dB) — possible noisy environment")
        else:
            issues.append(f"Normal crest factor ({crest_factor_db:.1f} dB)")

        # Dynamic range: natural speech typically 15–35 dB
        if dynamic_range_db < 10:
            score -= 20
            anomaly = True
            issues.append(f"Compressed dynamic range ({dynamic_range_db:.1f} dB) — possible TTS normalization")
        else:
            issues.append(f"Healthy dynamic range ({dynamic_range_db:.1f} dB)")

        score = max(0, min(100, score))
        return {
            "score": score,
            "detail": "; ".join(issues),
            "anomaly": anomaly,
            "crest_factor_db": float(crest_factor_db),
            "dynamic_range_db": float(dynamic_range_db),
        }

    except Exception as e:
        return {"score": 50, "detail": f"Dynamic range analysis failed: {str(e)}", "anomaly": False}


def run(y: np.ndarray, sr: int) -> dict:
    noise = analyze_noise_floor_consistency(y, sr)
    splice = detect_splices(y, sr)
    dynamic = analyze_dynamic_range(y, sr)

    overall = int(noise["score"] * 0.40 + splice["score"] * 0.40 + dynamic["score"] * 0.20)
    any_anomaly = noise["anomaly"] or splice["anomaly"] or dynamic["anomaly"]
    status = "PASS" if overall >= 70 else ("SUSPICIOUS" if overall >= 45 else "FAIL")

    return {
        "layer": "Cross-Modal Fingerprint",
        "score": overall,
        "status": status,
        "anomaly_detected": any_anomaly,
        "sub_metrics": {
            "noise_floor_consistency": noise,
            "splice_detection": splice,
            "dynamic_range_integrity": dynamic,
        },
    }