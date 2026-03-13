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
  baseX: number;
  baseY: number;
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
  const mouseRef = useRef({ x: -999, y: -999, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = canvas.offsetWidth;
    let h = canvas.offsetHeight;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize particles — Antigravity-style: more particles, spread evenly
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < 180; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        particlesRef.current.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          radius: 1.2 + Math.random() * 2,
          hue: 260 + Math.random() * 50, // purple range: 260-310
          alpha: 0.2 + Math.random() * 0.5,
          life: Math.random() * Math.PI * 2,
          speed: 0.2 + Math.random() * 0.4,
        });
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    const animate = () => {
      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const mouseActive = mouseRef.current.active;

      // --- Antigravity-style: soft circular glow under cursor ---
      if (mouseActive) {
        const aura = ctx.createRadialGradient(mx, my, 0, mx, my, 250);
        aura.addColorStop(0, "hsla(270, 70%, 60%, 0.08)");
        aura.addColorStop(0.3, "hsla(280, 60%, 70%, 0.04)");
        aura.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(mx, my, 250, 0, Math.PI * 2);
        ctx.fillStyle = aura;
        ctx.fill();
      }

      const particles = particlesRef.current;

      particles.forEach((p) => {
        const speedMult = isAnalyzing ? 2.5 : 1;

        // ── Antigravity magnetic attraction (smooth, strong, elastic) ──
        if (mouseActive) {
          const dx = mx - p.x;
          const dy = my - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 350 && dist > 3) {
            // Smooth elastic pull — stronger the closer
            const force = 0.08 * Math.pow(1 - dist / 350, 2);
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;

            // Particles very close orbit smoothly
            if (dist < 80) {
              const perpX = -dy / dist;
              const perpY = dx / dist;
              p.vx += perpX * 0.015;
              p.vy += perpY * 0.015;
            }
          }
        } else {
          // Gently drift back toward home position when mouse leaves
          const homeX = p.baseX - p.x;
          const homeY = p.baseY - p.y;
          p.vx += homeX * 0.001;
          p.vy += homeY * 0.001;
        }

        // Tiny ambient drift
        p.vx += (Math.random() - 0.5) * 0.005;
        p.vy += (Math.random() - 0.5) * 0.005;

        p.x += p.vx * p.speed * speedMult;
        p.y += p.vy * p.speed * speedMult;

        // Smooth damping (Antigravity feel — slow deceleration)
        p.vx *= 0.96;
        p.vy *= 0.96;

        // Soft wrap
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        // Pulse life
        p.life += 0.006 * p.speed;
        const pulse = 0.7 + Math.sin(p.life) * 0.25;

        // Check proximity to mouse for visual enhancement
        let nearMouse = false;
        let mouseDist = 999;
        if (mouseActive) {
          const dmx = mx - p.x;
          const dmy = my - p.y;
          mouseDist = Math.sqrt(dmx * dmx + dmy * dmy);
          nearMouse = mouseDist < 160;
        }

        const brightnessBoost = nearMouse ? 1.6 : 1;
        const sizeBoost = nearMouse ? 1.4 : 1;

        // Draw outer glow (soft purple)
        const glowR = p.radius * (nearMouse ? 7 : 4) * sizeBoost;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        glow.addColorStop(0, `hsla(${p.hue}, 60%, 55%, ${p.alpha * pulse * 0.2 * brightnessBoost})`);
        glow.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Draw core dot
        const coreR = p.radius * sizeBoost;
        ctx.beginPath();
        ctx.arc(p.x, p.y, coreR, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 65%, 50%, ${p.alpha * pulse * brightnessBoost * 0.7})`;
        ctx.fill();
      });

      // ── Constellation connections (Antigravity-style) ──
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Dynamic connection distance — much larger near cursor
          let maxDist = 80;
          if (mouseActive) {
            const midX = (p.x + p2.x) / 2;
            const midY = (p.y + p2.y) / 2;
            const dMouse = Math.sqrt((mx - midX) ** 2 + (my - midY) ** 2);
            if (dMouse < 200) {
              maxDist = 180; // Antigravity: wide web near cursor
            }
          }

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.12;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `hsla(${(p.hue + p2.hue) / 2}, 55%, 55%, ${alpha})`;
            ctx.lineWidth = dist < 40 ? 0.8 : 0.4;
            ctx.stroke();
          }
        }
      }

      // ── Lines from particles to cursor (Antigravity web) ──
      if (mouseActive) {
        particles.forEach((p) => {
          const dx = mx - p.x;
          const dy = my - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            const alpha = (1 - dist / 180) * 0.15;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mx, my);
            ctx.strokeStyle = `hsla(270, 65%, 55%, ${alpha})`;
            ctx.lineWidth = (1 - dist / 180) * 1.2;
            ctx.stroke();
          }
        });

        // Small cursor dot
        ctx.beginPath();
        ctx.arc(mx, my, 3, 0, Math.PI * 2);
        ctx.fillStyle = "hsla(270, 80%, 60%, 0.4)";
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", resize);
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
