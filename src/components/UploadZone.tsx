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
      className={`upload-zone ${dragOver ? "drag-over" : ""} ${compact ? "p-6" : "p-12"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,.m4a"
        className="hidden"
        onChange={handleChange}
      />
      <div className="flex flex-col items-center gap-3">
        {dragOver ? (
          <FileAudio className="h-12 w-12 text-primary" />
        ) : (
          <Upload className={`${compact ? "h-8 w-8" : "h-12 w-12"} text-muted-foreground`} />
        )}
        <div>
          <p className={`font-medium text-foreground ${compact ? "text-sm" : "text-lg"}`}>
            {label || "Drop audio file here or click to browse"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Supports .mp3, .wav, .m4a files
          </p>
        </div>
      </div>
    </div>
  );
}
