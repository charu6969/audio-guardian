"""
Biological Signature Analysis
- Micro-tremor detection (4-12 Hz involuntary jitter natural to humans)
- Glottal pulse irregularity (natural imperfection of vocal cords)
- Sub-glottal resonance (below 300 Hz, unique to chest/body resonance)
"""

import numpy as np
import librosa
from scipy.signal import butter, filtfilt, find_peaks


def _butter_bandpass(lowcut: float, highcut: float, fs: float, order: int = 4):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype="band")
    return b, a


def analyze_micro_tremor(y: np.ndarray, sr: int) -> dict:
    """
    Detect involuntary micro-tremors in fundamental frequency (4–12 Hz).
    Real human voices exhibit F0 modulation in this band.
    TTS/vocoder voices produce unnaturally stable F0.
    """
    try:
        # Extract F0 using pyin
        f0, voiced_flag, voiced_probs = librosa.pyin(
            y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7")
        )
        voiced_f0 = f0[voiced_flag]

        if len(voiced_f0) < 20:
            return {"score": 50, "detail": "Insufficient voiced frames for tremor analysis", "anomaly": False}

        # Interpolate to get a uniform time series
        voiced_f0_clean = voiced_f0[~np.isnan(voiced_f0)]
        if len(voiced_f0_clean) < 10:
            return {"score": 50, "detail": "Too many NaN F0 values", "anomaly": False}

        # Compute jitter (cycle-to-cycle F0 variation)
        jitter = np.mean(np.abs(np.diff(voiced_f0_clean))) / (np.mean(voiced_f0_clean) + 1e-8)

        # Real human jitter is typically 0.001–0.02 (0.1%–2%)
        # TTS jitter is often < 0.0005 (too smooth) or very erratic (over-synthesis)
        human_jitter_min = 0.001
        human_jitter_max = 0.025

        if human_jitter_min <= jitter <= human_jitter_max:
            score = 85 + min(15, int((jitter - human_jitter_min) / human_jitter_max * 15))
            anomaly = False
            detail = f"Natural micro-tremor detected (jitter={jitter:.4f})"
        elif jitter < human_jitter_min:
            score = max(10, int(jitter / human_jitter_min * 60))
            anomaly = True
            detail = f"Unnaturally smooth F0 — possible TTS/vocoder (jitter={jitter:.4f})"
        else:
            score = 55
            anomaly = False
            detail = f"High F0 variability — could be expressive speech or noise (jitter={jitter:.4f})"

        return {"score": int(score), "detail": detail, "anomaly": anomaly, "jitter_value": float(jitter)}

    except Exception as e:
        return {"score": 50, "detail": f"Tremor analysis failed: {str(e)}", "anomaly": False}


def analyze_glottal_pulse(y: np.ndarray, sr: int) -> dict:
    """
    Analyze glottal pulse irregularity via shimmer (amplitude variation).
    Human glottal pulses have natural shimmer of 1–10%.
    Synthetic voices are too regular or have algorithmic shimmer.
    """
    try:
        # Compute short-term energy as proxy for glottal amplitude
        frame_length = int(0.025 * sr)  # 25ms frames
        hop_length = int(0.010 * sr)    # 10ms hop

        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
        rms_nonzero = rms[rms > 0.001]  # filter silence

        if len(rms_nonzero) < 10:
            return {"score": 50, "detail": "Insufficient energy frames", "anomaly": False}

        # Shimmer: mean absolute difference between consecutive amplitudes
        shimmer = np.mean(np.abs(np.diff(rms_nonzero))) / (np.mean(rms_nonzero) + 1e-8)

        # Human shimmer typically 0.01–0.12
        if 0.01 <= shimmer <= 0.12:
            score = 80 + min(20, int(shimmer * 100))
            anomaly = False
            detail = f"Natural glottal shimmer detected ({shimmer:.3f})"
        elif shimmer < 0.01:
            score = max(15, int(shimmer / 0.01 * 50))
            anomaly = True
            detail = f"Abnormally low shimmer — likely synthetic voice ({shimmer:.3f})"
        else:
            score = 60
            anomaly = False
            detail = f"High shimmer — possibly noisy environment ({shimmer:.3f})"

        return {"score": int(score), "detail": detail, "anomaly": anomaly, "shimmer_value": float(shimmer)}

    except Exception as e:
        return {"score": 50, "detail": f"Glottal analysis failed: {str(e)}", "anomaly": False}


def analyze_subglottal_resonance(y: np.ndarray, sr: int) -> dict:
    """
    Detect sub-glottal resonance below 300 Hz.
    Real human voice production involves chest/body coupling.
    TTS systems often lack this natural sub-300 Hz energy signature.
    """
    try:
        # Check Nyquist
        if sr < 600:
            return {"score": 50, "detail": "Sample rate too low for sub-glottal analysis", "anomaly": False}

        # Bandpass filter for sub-glottal range (80–300 Hz)
        b, a = _butter_bandpass(80, min(300, sr // 2 - 10), float(sr))
        subglottal = filtfilt(b, a, y)

        # Full spectrum energy
        full_energy = np.sum(y ** 2) + 1e-10
        sub_energy = np.sum(subglottal ** 2)

        sub_ratio = sub_energy / full_energy

        # Real voice: sub-glottal ratio typically 0.05–0.35
        if 0.05 <= sub_ratio <= 0.40:
            score = 75 + min(25, int(sub_ratio * 60))
            anomaly = False
            detail = f"Sub-glottal resonance present (ratio={sub_ratio:.3f})"
        elif sub_ratio < 0.05:
            score = max(20, int(sub_ratio / 0.05 * 50))
            anomaly = True
            detail = f"Weak sub-glottal resonance — body resonance absent (ratio={sub_ratio:.3f})"
        else:
            score = 65
            anomaly = False
            detail = f"Strong low-frequency content detected (ratio={sub_ratio:.3f})"

        return {"score": int(score), "detail": detail, "anomaly": anomaly, "sub_ratio": float(sub_ratio)}

    except Exception as e:
        return {"score": 50, "detail": f"Sub-glottal analysis failed: {str(e)}", "anomaly": False}


def run(y: np.ndarray, sr: int) -> dict:
    tremor = analyze_micro_tremor(y, sr)
    glottal = analyze_glottal_pulse(y, sr)
    subglottal = analyze_subglottal_resonance(y, sr)

    # Weighted average
    overall = int(tremor["score"] * 0.4 + glottal["score"] * 0.35 + subglottal["score"] * 0.25)
    any_anomaly = tremor["anomaly"] or glottal["anomaly"] or subglottal["anomaly"]

    status = "PASS" if overall >= 70 else ("SUSPICIOUS" if overall >= 45 else "FAIL")

    return {
        "layer": "Biological Signature",
        "score": overall,
        "status": status,
        "anomaly_detected": any_anomaly,
        "sub_metrics": {
            "micro_tremor": tremor,
            "glottal_pulse": glottal,
            "subglottal_resonance": subglottal,
        },
    }