import { useEffect, useRef, type ReactNode } from "react";

interface MouseGlowEffectProps {
  children: ReactNode;
  className?: string;
}

export function MouseGlowEffect({ children, className = "" }: MouseGlowEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const glow = glowRef.current;
    if (!container || !glow) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      glow.style.background = `radial-gradient(600px circle at ${x}px ${y}px, hsla(189, 100%, 50%, 0.04), hsla(270, 100%, 65%, 0.02), transparent 60%)`;
    };

    container.addEventListener("mousemove", handleMouseMove);
    return () => container.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        ref={glowRef}
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500"
      />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
