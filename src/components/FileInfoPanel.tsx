import type { FileInfo } from "@/hooks/useAnalysis";
import { File, Clock, Hash, HardDrive, Radio } from "lucide-react";

interface FileInfoPanelProps {
  fileInfo: FileInfo;
  isAnalyzing: boolean;
}

export function FileInfoPanel({ fileInfo, isAnalyzing }: FileInfoPanelProps) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  return (
    <div className="forensic-card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">File Information</h3>
        {isAnalyzing ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Analyzing...
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-accent/50 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
            Analysis Complete
          </span>
        )}
      </div>

      <div className="space-y-3">
        {[
          { icon: File, label: "Filename", value: fileInfo.name },
          { icon: HardDrive, label: "Size", value: formatSize(fileInfo.size) },
          { icon: Clock, label: "Duration", value: `${fileInfo.duration}s` },
          { icon: Radio, label: "Format", value: fileInfo.format },
          { icon: Radio, label: "Sample Rate", value: `${fileInfo.sampleRate.toLocaleString()} Hz` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-2">
            <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-mono text-sm text-foreground">{value}</p>
            </div>
          </div>
        ))}

        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Upload Timestamp</p>
            <p className="font-mono text-xs text-foreground">
              {fileInfo.uploadTimestamp.toISOString()}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Hash className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">SHA-256 Hash</p>
            <p className="break-all font-mono text-xs text-primary/80">{fileInfo.sha256}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
