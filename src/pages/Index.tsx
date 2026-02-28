import { Shield, Fingerprint, ShieldCheck, FileText, Play } from "lucide-react";
import { UploadZone } from "@/components/UploadZone";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Fingerprint,
    title: "Biological Signature Analysis",
    description: "Detect micro-tremors, glottal pulses, and sub-glottal resonance patterns unique to human speech.",
  },
  {
    icon: ShieldCheck,
    title: "Digital Integrity Check",
    description: "Verify metadata consistency, encoding artifacts, and compression fingerprints for tampering evidence.",
  },
  {
    icon: FileText,
    title: "Forensic Report Generation",
    description: "Generate legal-grade forensic certificates with chain of custody documentation and anomaly timelines.",
  },
];

const Index = () => {
  const navigate = useNavigate();

  const handleFileSelect = (file: File) => {
    sessionStorage.setItem("audioFile", JSON.stringify({ name: file.name, size: file.size, type: file.type }));
    navigate("/dashboard", { state: { file } });
  };

  const loadDemoSample = (type: "authentic" | "synthetic") => {
    const name = type === "authentic" ? "witness-deposition-2024.wav" : "ai-generated-clone.wav";
    const file = new File([new ArrayBuffer(48000)], name, { type: "audio/wav" });
    navigate("/dashboard", { state: { file, demoPreset: type } });
  };

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-16">
      {/* Hero */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-mono text-xs text-primary">FORENSIC AUDIO ANALYSIS TOOLKIT</span>
        </div>

        <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Audio<span className="text-primary">Notary</span>
        </h1>

        <p className="mb-2 font-mono text-sm text-primary sm:text-base">
          The Digital Chain of Custody for Audio Evidence
        </p>

        <p className="mx-auto mb-10 max-w-xl text-sm text-muted-foreground sm:text-base">
          Multi-layer forensic trust analysis for voice authentication, deepfake detection,
          and legal-grade audio verification.
        </p>

        {/* Upload Zone */}
        <div className="mx-auto max-w-lg">
          <UploadZone onFileSelect={handleFileSelect} />
        </div>
      </div>

      {/* Feature Cards */}
      <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.title} className="forensic-card group transition-all duration-300 hover:border-primary/30">
            <feature.icon className="mb-3 h-8 w-8 text-primary transition-transform duration-300 group-hover:scale-110" />
            <h3 className="mb-1.5 text-sm font-semibold text-foreground">{feature.title}</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* Bottom line */}
      <div className="mt-16 text-center">
        <p className="font-mono text-xs text-muted-foreground">
          AudioNotary v1.0 — Clinical forensic analysis powered by multi-layer trust verification
        </p>
      </div>
    </main>
  );
};

export default Index;
