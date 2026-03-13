import { useEffect, useRef } from "react";

interface ParticleVisualizerProps {
  isAnalyzing?: boolean;
  activeLayer?: number;
  score?: number;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
  alpha: number;
  life: number;
  speed: number;
}

export function ParticleVisualizer({
  isAnalyzing = false,
  activeLayer = -1,
  score,
  className = "",
}: ParticleVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    // Initialize particles
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < 80; i++) {
        particlesRef.current.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: 1 + Math.random() * 2,
          hue: 189 + Math.random() * 80,
          alpha: 0.1 + Math.random() * 0.4,
          life: Math.random(),
          speed: 0.5 + Math.random() * 0.5,
        });
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    canvas.addEventListener("mousemove", handleMouseMove);

    const animate = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const baseHue = isAnalyzing
        ? [189, 270, 155, 43, 210, 330, 0][Math.min(activeLayer, 6)] || 189
        : score !== undefined
          ? score >= 70 ? 155 : score >= 45 ? 43 : 0
          : 189;

      particlesRef.current.forEach((p) => {
        // Speed boost during analysis
        const speedMult = isAnalyzing ? 2.5 : 1;

        // Mouse attraction
        const dx = mouseRef.current.x - p.x;
        const dy = mouseRef.current.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150 && dist > 0) {
          p.vx += (dx / dist) * 0.02;
          p.vy += (dy / dist) * 0.02;
        }

        p.x += p.vx * p.speed * speedMult;
        p.y += p.vy * p.speed * speedMult;

        // Damping
        p.vx *= 0.99;
        p.vy *= 0.99;

        // Wrap around edges
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        // Update hue toward target
        const targetHue = baseHue + (Math.random() - 0.5) * 40;
        p.hue += (targetHue - p.hue) * 0.01;

        // Pulse life
        p.life += 0.005 * p.speed;
        const pulse = 0.5 + Math.sin(p.life * Math.PI * 2) * 0.3;

        // Draw glow
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 4);
        glow.addColorStop(0, `hsla(${p.hue}, 100%, 60%, ${p.alpha * pulse * 0.3})`);
        glow.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 4, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Draw core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${p.alpha * pulse})`;
        ctx.fill();
      });

      // Draw connections between close particles
      particlesRef.current.forEach((p, i) => {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const p2 = particlesRef.current[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `hsla(${(p.hue + p2.hue) / 2}, 80%, 60%, ${(1 - dist / 100) * 0.08})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isAnalyzing, activeLayer, score]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-auto ${className}`}
      style={{ imageRendering: "auto" }}
    />
  );
}
