"""
ASR Service — Speech to Text
Uses HuggingFace Transformers pipeline (already installed for Deepfake Classifier).
NO additional pip installs required.

Strategy:
  1. Primary:  transformers ASR pipeline with openai/whisper-tiny (~39MB download on first run)
  2. Fallback: SpeechRecognition library (if installed)
  3. Fallback: openai-whisper (if installed)
"""

import os
import tempfile
import numpy as np
from typing import List, Dict, Tuple

# ── Config ─────────────────────────────────────────────────────────────────────
# Model for transformers pipeline — tiny is fastest, small is more accurate
WHISPER_HF_MODEL = os.environ.get("WHISPER_HF_MODEL", "openai/whisper-tiny")
TARGET_SR = 16000  # Whisper expects 16kHz

# ── Module-level cache ─────────────────────────────────────────────────────────
_hf_pipeline = None
_hf_attempted = False


# ── Method 1: HuggingFace Transformers ASR (ZERO new installs needed) ─────────

def _try_load_hf_pipeline():
    """Load HuggingFace ASR pipeline using already-installed transformers + torch."""
    global _hf_pipeline, _hf_attempted
    if _hf_attempted:
        return _hf_pipeline
    _hf_attempted = True
    try:
        from transformers import pipeline as hf_pipeline
        print(f"[ASR] Loading HuggingFace ASR model '{WHISPER_HF_MODEL}'...")
        _hf_pipeline = hf_pipeline(
            "automatic-speech-recognition",
            model=WHISPER_HF_MODEL,
            device=-1,  # CPU
        )
        print(f"[ASR] HuggingFace ASR ready ({WHISPER_HF_MODEL}).")
    except Exception as e:
        print(f"[ASR] HuggingFace ASR pipeline failed: {e}")
        _hf_pipeline = None
    return _hf_pipeline


def _transcribe_with_hf(y: np.ndarray, sr: int) -> Tuple[str, List[Dict]]:
    """Transcribe using HuggingFace transformers ASR pipeline."""
    pipe = _try_load_hf_pipeline()
    if pipe is None:
        return "", []

    try:
        import librosa

        # Resample to 16kHz if needed
        if sr != TARGET_SR:
            y = librosa.resample(y, orig_sr=sr, target_sr=TARGET_SR)

        # Normalize
        peak = np.max(np.abs(y))
        if peak > 0:
            y = y / peak

        # For long audio, process in chunks (pipeline handles this with chunk_length_s)
        result = pipe(
            {"array": y, "sampling_rate": TARGET_SR},
            chunk_length_s=30,
            stride_length_s=5,
            return_timestamps="word",
        )

        transcript = result.get("text", "").strip()

        # Extract word timestamps if available
        word_timestamps: List[Dict] = []
        for chunk in result.get("chunks", []):
            ts = chunk.get("timestamp", (0, 0))
            word_timestamps.append({
                "word": chunk.get("text", "").strip(),
                "start": float(ts[0]) if ts[0] is not None else 0.0,
                "end": float(ts[1]) if ts[1] is not None else 0.0,
            })

        print(f"[ASR] HF transcribed {len(transcript)} chars, {len(word_timestamps)} words")
        return transcript, word_timestamps

    except Exception as e:
        print(f"[ASR] HuggingFace transcription failed: {e}")
        return "", []


# ── Method 2: SpeechRecognition (optional, if installed) ──────────────────────

def _try_sr_transcribe(audio_path: str) -> Tuple[str, List[Dict]]:
    """Try SpeechRecognition library if installed."""
    try:
        import speech_recognition as sr_lib
        recognizer = sr_lib.Recognizer()
        with sr_lib.AudioFile(audio_path) as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            audio_data = recognizer.record(source)
        transcript = recognizer.recognize_google(audio_data, language="en-US")
        print(f"[ASR] SpeechRecognition transcribed {len(transcript)} chars")
        return transcript.strip(), []
    except ImportError:
        return "", []
    except Exception as e:
        print(f"[ASR] SpeechRecognition failed: {e}")
        return "", []


# ── Audio helpers ─────────────────────────────────────────────────────────────

def _trim_silence(y: np.ndarray, sr: int, top_db: float = 40.0) -> np.ndarray:
    """Strip leading/trailing silence."""
    try:
        import librosa
        trimmed, _ = librosa.effects.trim(y, top_db=top_db)
        if len(trimmed) >= sr * 0.5:
            return trimmed
    except Exception:
        pass
    return y


def _save_array_to_wav(y: np.ndarray, sr: int) -> str:
    """Save numpy audio array to a temporary WAV file."""
    try:
        import soundfile as sf
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            sf.write(tmp.name, y, sr)
            return tmp.name
    except ImportError:
        from scipy.io import wavfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp_path = tmp.name
        y_int16 = (y * 32767).astype(np.int16)
        wavfile.write(tmp_path, sr, y_int16)
        return tmp_path


# ── Public API ────────────────────────────────────────────────────────────────

def transcribe(audio_path: str) -> Tuple[str, List[Dict]]:
    """
    Transcribe audio file. Tries in order:
    1. HuggingFace transformers pipeline (uses already-installed transformers+torch)
    2. SpeechRecognition (if installed)
    """
    # Method 1: Load audio and use HF pipeline
    try:
        import librosa
        y, sr = librosa.load(audio_path, sr=None, mono=True)
        transcript, timestamps = _transcribe_with_hf(y, sr)
        if transcript:
            return transcript, timestamps
    except Exception as e:
        print(f"[ASR] HF path failed: {e}")

    # Method 2: SpeechRecognition
    transcript, timestamps = _try_sr_transcribe(audio_path)
    if transcript:
        return transcript, timestamps

    return "", []


def transcribe_from_array(y: np.ndarray, sr: int) -> Tuple[str, List[Dict]]:
    """Transcribe from numpy audio array."""
    y_trimmed = _trim_silence(y, sr)

    # Method 1: HF pipeline (direct from array — no file I/O needed)
    transcript, timestamps = _transcribe_with_hf(y_trimmed, sr)
    if transcript:
        return transcript, timestamps

    # Method 2: Save to file and try SpeechRecognition
    tmp_path = None
    try:
        tmp_path = _save_array_to_wav(y_trimmed, sr)
        transcript, timestamps = _try_sr_transcribe(tmp_path)
        if transcript:
            return transcript, timestamps
    except Exception as e:
        print(f"[ASR] File-based transcription failed: {e}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

    return "", []


def is_available() -> bool:
    """Returns True if any transcription method is available."""
    # HuggingFace transformers is the primary — should work since
    # transformers+torch are already installed for the Deepfake Classifier
    if _try_load_hf_pipeline() is not None:
        return True
    # Check SpeechRecognition
    try:
        import speech_recognition
        return True
    except ImportError:
        pass
    return False


def get_engine() -> str:
    """Returns which ASR engine is active."""
    if _try_load_hf_pipeline() is not None:
        return f"HuggingFace ({WHISPER_HF_MODEL})"
    try:
        import speech_recognition
        return "SpeechRecognition (Google)"
    except ImportError:
        pass
    return "none"