"""
Spectrogram Generator
Produces:
  1. A base64-encoded PNG spectrogram image (mel scale, annotated with anomaly markers)
  2. Lightweight waveform + frequency-band data for the frontend canvas
  3. Anomaly timeline with timestamps and labels for the overlay
"""

import io
import base64
import numpy as np
import librosa
import librosa.display
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend — must be before pyplot import
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.colors import LinearSegmentedColormap
from typing import List, Dict, Any


# ── Custom dark spectrogram colormap ─────────────────────────────────────────
_CMAP = LinearSegmentedColormap.from_list(
    "audionotary",
    ["#0a0f1e", "#0d2137", "#003d66", "#006994", "#00b4cc", "#00d4ff",
     "#66ffe0", "#b3ffb3", "#ffff80", "#ff8800", "#ff2200"],
    N=256,
)


# ── Anomaly detection helpers ─────────────────────────────────────────────────

def _find_spectral_anomalies(y: np.ndarray, sr: int, hop_length: int = 512) -> List[Dict]:
    """
    Identify time regions with unusual spectral characteristics.
    Returns a list of {time_sec, label, severity} dicts.
    """
    anomalies = []

    # 1. Spectral flux spikes (splice / edit candidates)
    stft = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop_length))
    flux = np.sqrt(np.sum(np.diff(stft, axis=1) ** 2, axis=0))
    threshold = np.mean(flux) + 3.5 * np.std(flux)
    spike_frames = np.where(flux > threshold)[0]
    # Cluster nearby frames
    if len(spike_frames) > 0:
        clusters = []
        cur = [spike_frames[0]]
        for f in spike_frames[1:]:
            if f - cur[-1] < 20:
                cur.append(f)
            else:
                clusters.append(cur)
                cur = [f]
        clusters.append(cur)
        for cluster in clusters[:5]:
            t = float(librosa.frames_to_time(cluster[0], sr=sr, hop_length=hop_length))
            anomalies.append({"time_sec": round(t, 2), "label": "Spectral discontinuity", "severity": "high"})

    # 2. Sudden energy drops (unnatural silence / edit)
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    rms_diff = np.abs(np.diff(rms))
    drop_threshold = np.mean(rms_diff) + 4 * np.std(rms_diff)
    drops = np.where(rms_diff > drop_threshold)[0]
    for d in drops[:3]:
        t = float(librosa.frames_to_time(d, sr=sr, hop_length=hop_length))
        anomalies.append({"time_sec": round(t, 2), "label": "Abrupt energy transition", "severity": "medium"})

    # 3. Noise floor shift (environment change)
    window = max(1, len(rms) // 8)
    segment_floors = [float(np.percentile(rms[i:i+window], 5))
                      for i in range(0, len(rms) - window, window)]
    if len(segment_floors) > 2:
        floor_std = np.std(segment_floors)
        floor_mean = np.mean(segment_floors)
        for i, f in enumerate(segment_floors):
            if abs(f - floor_mean) > 2.5 * floor_std:
                t = float(i * window * hop_length / sr)
                anomalies.append({"time_sec": round(t, 2), "label": "Noise floor shift", "severity": "medium"})

    # Deduplicate by time (within 0.3s)
    deduped = []
    for a in sorted(anomalies, key=lambda x: x["time_sec"]):
        if not deduped or a["time_sec"] - deduped[-1]["time_sec"] > 0.3:
            deduped.append(a)

    return deduped[:10]  # cap at 10 markers


# ── Spectrogram image generator ───────────────────────────────────────────────

def generate_spectrogram_image(
    y: np.ndarray,
    sr: int,
    anomalies: List[Dict],
    width_px: int = 900,
    height_px: int = 340,
    dpi: int = 100,
) -> str:
    """
    Render a mel spectrogram with anomaly markers and return as base64 PNG string.
    """
    fig_w = width_px / dpi
    fig_h = height_px / dpi

    fig, ax = plt.subplots(figsize=(fig_w, fig_h), facecolor="#0a0f1e")
    ax.set_facecolor("#0a0f1e")

    # Mel spectrogram
    n_mels = 128
    hop_length = 512
    mel = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=n_mels, hop_length=hop_length, fmax=sr // 2)
    mel_db = librosa.power_to_db(mel, ref=np.max)

    duration = len(y) / sr
    img = librosa.display.specshow(
        mel_db,
        sr=sr,
        hop_length=hop_length,
        x_axis="time",
        y_axis="mel",
        fmax=sr // 2,
        ax=ax,
        cmap=_CMAP,
    )

    # Colorbar
    cbar = fig.colorbar(img, ax=ax, format="%+2.0f dB", pad=0.01)
    cbar.ax.yaxis.set_tick_params(color="#9ca3af", labelcolor="#9ca3af", labelsize=7)
    cbar.outline.set_edgecolor("#1f2937")

    # Anomaly markers
    severity_colors = {"high": "#ef4444", "medium": "#fbbf24", "low": "#60a5fa"}
    for ann in anomalies:
        t = ann["time_sec"]
        color = severity_colors.get(ann["severity"], "#fbbf24")
        ax.axvline(x=t, color=color, linewidth=1.5, alpha=0.85, linestyle="--")
        ax.text(
            t + duration * 0.005, mel_db.shape[0] * 0.02,
            ann["label"],
            color=color, fontsize=6.5, rotation=90,
            va="bottom", ha="left",
            fontfamily="monospace",
        )

    # Styling
    ax.tick_params(colors="#9ca3af", labelsize=7)
    ax.spines[:].set_color("#1f2937")
    ax.yaxis.label.set_color("#9ca3af")
    ax.xaxis.label.set_color("#9ca3af")
    ax.set_xlabel("Time (s)", color="#9ca3af", fontsize=8)
    ax.set_ylabel("Hz (mel)", color="#9ca3af", fontsize=8)
    ax.set_title("Mel Spectrogram — Forensic View", color="#00d4ff", fontsize=9, pad=4)

    # Legend
    legend_patches = [
        mpatches.Patch(color="#ef4444", label="High severity"),
        mpatches.Patch(color="#fbbf24", label="Medium severity"),
    ]
    ax.legend(handles=legend_patches, loc="upper right", fontsize=6,
              facecolor="#111827", edgecolor="#1f2937", labelcolor="#9ca3af")

    plt.tight_layout(pad=0.3)

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, bbox_inches="tight",
                facecolor="#0a0f1e", edgecolor="none")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


# ── Frequency band energy breakdown ──────────────────────────────────────────

def _frequency_bands(y: np.ndarray, sr: int) -> Dict[str, float]:
    """
    Split spectrum into sub-bass, bass, mid, upper-mid, presence, air bands.
    Returns normalised energy per band (0.0 – 1.0).
    """
    bands = {
        "sub_bass": (20, 80),
        "bass": (80, 300),
        "mid": (300, 2000),
        "upper_mid": (2000, 5000),
        "presence": (5000, 10000),
        "air": (10000, min(20000, sr // 2 - 1)),
    }
    stft = np.abs(librosa.stft(y, n_fft=4096))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)
    total_energy = np.mean(stft) + 1e-8
    result = {}
    for name, (lo, hi) in bands.items():
        mask = (freqs >= lo) & (freqs <= hi)
        if mask.any():
            result[name] = float(np.mean(stft[mask, :]) / total_energy)
        else:
            result[name] = 0.0
    # Normalise to 0–1 range
    max_val = max(result.values()) + 1e-8
    return {k: round(v / max_val, 4) for k, v in result.items()}


# ── Waveform envelope ─────────────────────────────────────────────────────────

def _waveform_envelope(y: np.ndarray, n_points: int = 400) -> List[float]:
    """Downsample to N points for frontend waveform display."""
    chunk = max(1, len(y) // n_points)
    envelope = []
    for i in range(n_points):
        start = i * chunk
        end = min(start + chunk, len(y))
        if start >= len(y):
            break
        envelope.append(float(np.max(np.abs(y[start:end]))))
    return envelope


# ── Public entry point ────────────────────────────────────────────────────────

def generate(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Returns:
      - spectrogram_b64: base64 PNG of annotated mel spectrogram
      - waveform_envelope: list of 400 amplitude values
      - frequency_bands: energy per band
      - anomaly_markers: list of detected anomalies with timestamps
      - duration_sec, sample_rate
    """
    hop_length = 512
    duration = len(y) / sr

    anomalies = _find_spectral_anomalies(y, sr, hop_length=hop_length)

    try:
        spectrogram_b64 = generate_spectrogram_image(y, sr, anomalies)
    except Exception as e:
        spectrogram_b64 = None
        print(f"[Spectrogram] Image generation failed: {e}")

    waveform = _waveform_envelope(y)
    bands = _frequency_bands(y, sr)

    return {
        "spectrogram_b64": spectrogram_b64,      # base64 PNG string
        "waveform_envelope": waveform,            # 400 floats for canvas
        "frequency_bands": bands,                 # 6 bands for bar chart
        "anomaly_markers": anomalies,             # [{time_sec, label, severity}]
        "duration_sec": round(duration, 3),
        "sample_rate": int(sr),
    }