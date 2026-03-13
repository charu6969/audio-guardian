import { useCallback, useState, useRef } from "react";
import { Upload, FileAudio } from "lucide-react";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  compact?: boolean;
  label?: string;
}

export function UploadZone({ onFileSelect, compact, label }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  return (
    <div
      className={`relative overflow-hidden transition-all duration-300 cursor-pointer border border-border/50 bg-secondary/20 shadow-[0_0_20px_rgba(0,0,0,0.2)] ${
        dragOver 
          ? "border-primary bg-primary/5 shadow-[0_0_30px_rgba(0,255,136,0.15)]" 
          : "hover:border-primary/50 hover:bg-secondary/40"
      } ${compact ? "rounded-lg p-6" : "rounded-xl p-16"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      {/* Background forensic grid effect */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }}
      />

      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,.m4a"
        className="hidden"
        onChange={handleChange}
      />
      <div className="relative flex flex-col items-center gap-6 z-10">
        <div className="relative flex items-center justify-center">
          {/* Animated pulsing rings */}
          {dragOver ? (
            <>
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring" />
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring" style={{ animationDelay: '1s' }} />
            </>
          ) : (
            <div className="absolute inset-0 rounded-full bg-muted/10 transform transition-transform duration-500 group-hover:scale-110" />
          )}
          
          <div className={`relative z-10 flex items-center justify-center rounded-full bg-background border border-border/50 shadow-lg ${compact ? "h-14 w-14" : "h-20 w-20"}`}>
            {dragOver ? (
              <FileAudio className={`${compact ? "h-6 w-6" : "h-8 w-8"} text-primary`} />
            ) : (
              <Upload className={`${compact ? "h-6 w-6" : "h-8 w-8"} text-muted-foreground`} />
            )}
          </div>
        </div>

        <div className="text-center">
          <p className={`font-mono tracking-wide ${dragOver ? "text-primary" : "text-foreground"} ${compact ? "text-sm" : "text-lg"}`}>
            {dragOver ? "INITIATE SCAN" : label || "DROP AUDIO FOR ANALYSIS"}
          </p>
          <p className="mt-2 font-mono text-xs text-muted-foreground uppercase tracking-widest opacity-70">
            Supported Formats: MP3, WAV, M4A
          </p>
        </div>
      </div>
    </div>
  );
}
