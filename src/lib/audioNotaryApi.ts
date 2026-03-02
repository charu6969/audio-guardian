import { analyzeAudio, downloadReport } from "@/lib/audioNotaryApi";
import { AnalysisResult, CompareResult } from "@/types/audioNotaryTypes";

const API_BASE =
  import.meta.env.VITE_AUDIO_NOTARY_API_URL || "http://localhost:8000";
