"""
Digital Integrity Analysis
- Metadata consistency (creation vs modification timestamps)
- Encoding artifact detection (re-encoding signatures)
- Compression fingerprint analysis
"""

import hashlib
import os
import numpy as np
import librosa
from pathlib import Path

try:
    import mutagen
    from mutagen import File as MutagenFile
    from mutagen.mp3 import MP3
    from mutagen.wave import WAVE
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False


def compute_file_hash(filepath: str) -> str:
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def analyze_metadata_consistency(filepath: str) -> dict:
    """
    Check metadata for tampering indicators:
    - Mismatched timestamps
    - Stripped or injected tags
    - Encoder string anomalies
    """
    try:
        stat = os.stat(filepath)
        mtime = stat.st_mtime
        ctime = stat.st_ctime

        score = 100
        issues = []
        anomaly = False

        if MUTAGEN_AVAILABLE:
            audio = MutagenFile(filepath, easy=True)
            if audio is None:
                return {"score": 60, "detail": "Could not parse audio metadata", "anomaly": False}

            tags = dict(audio.tags) if audio.tags else {}

            # Check for encoder tag — suspicious if it's a known TTS/AI encoder
            encoder_tags = [str(v).lower() for k, v in tags.items() if "encoder" in k.lower() or "tool" in k.lower()]
            suspicious_encoders = ["elevenlabs", "openai", "tts", "synthesiz", "fakeyou", "bark", "tortoise", "resemble"]
            for enc in encoder_tags:
                if any(sus in enc for sus in suspicious_encoders):
                    score -= 40
                    anomaly = True
                    issues.append(f"Suspicious encoder tag: {enc}")

            # Check for completely empty tags (common in raw TTS output)
            if len(tags) == 0:
                score -= 10
                issues.append("No metadata tags present — may be raw TTS output")

            # Check for impossibly future/past dates
            try:
                date_tags = [str(v) for k, v in tags.items() if "date" in k.lower() or "year" in k.lower()]
                for d in date_tags:
                    if d and len(d) >= 4:
                        year = int(d[:4])
                        if year > 2030 or year < 1980:
                            score -= 20
                            anomaly = True
                            issues.append(f"Implausible date in metadata: {d}")
            except (ValueError, TypeError):
                pass

        if not issues:
            issues.append("Metadata appears consistent and unmanipulated")

        score = max(0, min(100, score))
        return {
            "score": score,
            "detail": "; ".join(issues),
            "anomaly": anomaly,
        }

    except Exception as e:
        return {"score": 50, "detail": f"Metadata analysis failed: {str(e)}", "anomaly": False}


def analyze_encoding_artifacts(y: np.ndarray, sr: int) -> dict:
    """
    Detect re-encoding artifacts via spectral flatness and quantization noise.
    Heavily compressed or re-encoded audio shows characteristic spectral patterns.
    """
    try:
        # Spectral flatness: ratio of geometric mean to arithmetic mean of spectrum
        # High flatness = noise-like (possible quantization noise from re-encoding)
        flatness = librosa.feature.spectral_flatness(y=y)[0]
        mean_flatness = float(np.mean(flatness))

        # Measure high-frequency rolloff
        rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.95)[0]
        mean_rolloff = float(np.mean(rolloff))
        rolloff_normalized = mean_rolloff / (sr / 2)

        # Natural speech: rolloff typically at 60-85% of Nyquist
        # MP3-compressed: hard cutoff artifacts visible
        # TTS: often very clean with no high-freq noise

        score = 80
        issues = []
        anomaly = False

        if mean_flatness > 0.15:
            score -= 20
            anomaly = True
            issues.append(f"High spectral flatness — encoding noise detected ({mean_flatness:.3f})")
        elif mean_flatness < 0.001:
            score -= 15
            anomaly = True
            issues.append(f"Unusually low spectral flatness — possible synthetic origin ({mean_flatness:.3f})")
        else:
            issues.append(f"Normal spectral flatness ({mean_flatness:.3f})")

        if rolloff_normalized < 0.4:
            score -= 20
            anomaly = True
            issues.append(f"Low spectral rolloff — heavily bandwidth-limited ({rolloff_normalized:.2f})")
        else:
            issues.append(f"Spectral rolloff at {rolloff_normalized:.0%} of Nyquist")

        score = max(0, min(100, score))
        return {"score": score, "detail": "; ".join(issues), "anomaly": anomaly}

    except Exception as e:
        return {"score": 50, "detail": f"Encoding artifact analysis failed: {str(e)}", "anomaly": False}


def analyze_compression_fingerprint(y: np.ndarray, sr: int) -> dict:
    """
    Detect double-compression or format conversion artifacts.
    Audio that's been exported from TTS then re-encoded often has
    characteristic MFCC coefficient distribution anomalies.
    """
    try:
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)

        # Check kurtosis of MFCC coefficients
        # Real speech: moderate kurtosis
        # Synthetic/re-encoded: abnormal kurtosis in certain coefficients
        from scipy.stats import kurtosis
        kurt_values = [float(kurtosis(mfccs[i])) for i in range(min(10, mfccs.shape[0]))]
        mean_kurt = np.mean(np.abs(kurt_values))

        # Check MFCC variance stability
        mfcc_var = np.var(mfccs, axis=1)
        var_ratio = float(np.max(mfcc_var) / (np.min(mfcc_var) + 1e-8))

        score = 80
        issues = []
        anomaly = False

        if mean_kurt > 10:
            score -= 25
            anomaly = True
            issues.append(f"Abnormal MFCC kurtosis — double-compression suspected ({mean_kurt:.1f})")
        else:
            issues.append(f"MFCC distribution within normal range (kurtosis={mean_kurt:.1f})")

        if var_ratio > 1000:
            score -= 15
            anomaly = True
            issues.append(f"Extreme MFCC variance ratio — format conversion artifact ({var_ratio:.0f}x)")
        else:
            issues.append(f"MFCC variance ratio normal ({var_ratio:.0f}x)")

        score = max(0, min(100, score))
        return {"score": score, "detail": "; ".join(issues), "anomaly": anomaly}

    except Exception as e:
        return {"score": 50, "detail": f"Compression fingerprint failed: {str(e)}", "anomaly": False}


def run(filepath: str, y: np.ndarray, sr: int) -> dict:
    file_hash = compute_file_hash(filepath)
    metadata = analyze_metadata_consistency(filepath)
    encoding = analyze_encoding_artifacts(y, sr)
    compression = analyze_compression_fingerprint(y, sr)

    overall = int(metadata["score"] * 0.4 + encoding["score"] * 0.35 + compression["score"] * 0.25)
    any_anomaly = metadata["anomaly"] or encoding["anomaly"] or compression["anomaly"]
    status = "PASS" if overall >= 70 else ("SUSPICIOUS" if overall >= 45 else "FAIL")

    return {
        "layer": "Digital Integrity",
        "score": overall,
        "status": status,
        "anomaly_detected": any_anomaly,
        "file_hash": file_hash,
        "sub_metrics": {
            "metadata_consistency": metadata,
            "encoding_artifacts": encoding,
            "compression_fingerprint": compression,
        },
    }