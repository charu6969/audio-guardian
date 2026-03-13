import { Shield, Fingerprint, ShieldCheck, FileText, Zap, Brain, Waves } from "lucide-react";
import { UploadZone } from "@/components/UploadZone";
import { ParticleVisualizer } from "@/components/ParticleVisualizer";
import { useNavigate } from "react-router-dom";

const features = [
  {
    icon: Fingerprint,
    title: "Biological Signature Analysis",
    description:
      "Detect micro-tremors, glottal pulses, and sub-glottal resonance patterns unique to human speech.",
    gradient: "from-purple-500/20 to-pink-500/10",
    iconColor: "text-purple-400",
  },
  {
    icon: Brain,
    title: "ML Deepfake Detection",
    description:
      "Neural network analysis using wav2vec2 models fine-tuned for synthetic speech and voice clone detection.",
    gradient: "from-cyan-500/20 to-blue-500/10",
    iconColor: "text-cyan-400",
  },
  {
    icon: ShieldCheck,
    title: "Digital Integrity Check",
    description:
      "Verify metadata consistency, encoding artifacts, and compression fingerprints for tampering evidence.",
    gradient: "from-blue-500/20 to-indigo-500/10",
    iconColor: "text-blue-400",
  },
  {
    icon: Waves,
    title: "Environmental Analysis",
    description:
      "Analyze room acoustics, background noise uniformity, and acoustic signature consistency.",
    gradient: "from-emerald-500/20 to-green-500/10",
    iconColor: "text-emerald-400",
  },
  {
    icon: Zap,
    title: "Social Engineering Detection",
    description:
      "NLP-powered scan detecting fraud patterns — urgency manipulation, authority impersonation, and data requests.",
    gradient: "from-amber-500/20 to-orange-500/10",
    iconColor: "text-amber-400",
  },
  {
    icon: FileText,
    title: "Forensic Report Generation",
    description:
      "Generate court-ready forensic certificates with chain of custody documentation and anomaly timelines.",
    gradient: "from-pink-500/20 to-rose-500/10",
    iconColor: "text-pink-400",
  },
];

const Index = () => {
  const navigate = useNavigate();

  const handleFileSelect = (file: File) => {
    navigate("/dashboard", { state: { file } });
  };

  return (
    <main className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-16 overflow-hidden">
      {/* Particle background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <ParticleVisualizer />
      </div>

      {/* Grid background */}
      <div className="absolute inset-0 cyber-grid-bg opacity-30 pointer-events-none" />

      {/* Gradient overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "var(--gradient-hero)" }}
      />

      {/* Hero */}
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-4 py-1.5 backdrop-blur-sm">
          <Shield className="h-4 w-4 text-cyan-400" />
          <span className="font-mono text-xs text-cyan-400 tracking-wider">
            FORENSIC AUDIO ANALYSIS TOOLKIT
          </span>
        </div>

        <h1 className="mb-4 text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
          <span className="font-display bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-color-shift">
            AudioNotary
          </span>
        </h1>

        <p className="mb-2 font-mono text-sm sm:text-base bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          The Digital Chain of Custody for Audio Evidence
        </p>

        <p className="mx-auto mb-10 max-w-xl text-sm text-muted-foreground sm:text-base leading-relaxed">
          Multi-layer forensic trust analysis for voice authentication, deepfake
          detection, and legal-grade audio verification.
        </p>

        {/* Upload Zone */}
        <div className="mx-auto max-w-lg">
          <UploadZone onFileSelect={handleFileSelect} />
          <p className="mt-3 font-mono text-xs text-muted-foreground/60">
            Supported: .mp3 · .wav · .flac · .m4a · .ogg · .aac · Max 50MB
          </p>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="relative z-10 mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, i) => (
          <div
            key={feature.title}
            className="forensic-card card-tilt group"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${feature.gradient}`}>
              <feature.icon className={`h-5 w-5 ${feature.iconColor} transition-transform duration-300 group-hover:scale-110`} />
            </div>
            <h3 className="mb-1.5 text-sm font-semibold text-foreground">
              {feature.title}
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      {/* Bottom line */}
      <div className="relative z-10 mt-16 text-center">
        <p className="font-mono text-xs text-muted-foreground/40">
          AudioNotary v2.0 — Multi-layer forensic analysis powered by AI trust verification
        </p>
      </div>
    </main>
  );
};

export default Index;
