import { Shield } from "lucide-react";

export default function About() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        <Shield className="mx-auto mb-4 h-12 w-12 text-primary" />
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          About Audio<span className="text-primary">Notary</span>
        </h1>
        <p className="mb-8 text-muted-foreground">
          Digital Audio Forensic Toolkit v1.0
        </p>
      </div>

      <div className="forensic-card space-y-4 text-sm text-muted-foreground">
        <p>
          AudioNotary is a multi-layer forensic trust analysis platform designed for voice authentication,
          deepfake detection, and legal-grade audio verification. Our five-layer Trust Stack analyzes
          biological signatures, digital integrity, environmental consistency, temporal coherence, and
          cross-modal fingerprints to deliver comprehensive forensic assessments.
        </p>
        <p>
          Designed for forensic experts, journalists, legal professionals, and anyone who needs to verify
          the authenticity of audio evidence. AudioNotary generates standardized forensic certificates with
          full chain-of-custody documentation.
        </p>
        <p className="font-mono text-xs text-primary/60">
          Note: This is a UI prototype demonstrating the forensic analysis interface. Actual forensic
          analysis would require integration with specialized audio processing backends.
        </p>
      </div>
    </div>
  );
}
