import { useEffect, useRef } from "react";

interface NeuralNetworkVizProps {
  activeLayer: number; // -1=idle, 0-6=processing that layer
  className?: string;
}

interface Node {
  x: number;
  y: number;
  layer: number;
  radius: number;
  activation: number;
}

interface Connection {
  from: Node;
  to: Node;
  strength: number;
}

export function NeuralNetworkViz({ activeLayer, className = "" }: NeuralNetworkVizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    // Create network nodes (5 visual layers, representing the 7 analysis layers)
    const layerCounts = [3, 5, 7, 5, 3];
    const nodes: Node[] = [];
    const layerSpacing = w / (layerCounts.length + 1);

    layerCounts.forEach((count, layerIdx) => {
      const x = layerSpacing * (layerIdx + 1);
      const spacing = h / (count + 1);
      for (let i = 0; i < count; i++) {
        nodes.push({
          x,
          y: spacing * (i + 1),
          layer: layerIdx,
          radius: 4 + Math.random() * 2,
          activation: 0,
        });
      }
    });

    // Create connections between adjacent layers
    const connections: Connection[] = [];
    for (let l = 0; l < layerCounts.length - 1; l++) {
      const fromNodes = nodes.filter(n => n.layer === l);
      const toNodes = nodes.filter(n => n.layer === l + 1);
      fromNodes.forEach(from => {
        toNodes.forEach(to => {
          if (Math.random() > 0.3) {
            connections.push({ from, to, strength: 0.2 + Math.random() * 0.8 });
          }
        });
      });
    }

    nodesRef.current = nodes;
    connectionsRef.current = connections;

    const animate = () => {
      timeRef.current += 0.02;
      ctx.clearRect(0, 0, w, h);

      // Map activeLayer (0-6) to visual layer (0-4)
      const visualActive = activeLayer >= 0 ? Math.min(Math.floor(activeLayer * 5 / 7), 4) : -1;

      // Update node activations
      nodes.forEach(node => {
        if (visualActive >= 0 && node.layer <= visualActive) {
          node.activation = Math.min(1, node.activation + 0.05);
        } else if (activeLayer === -1) {
          node.activation = 0.15 + Math.sin(timeRef.current * 2 + node.x * 0.01 + node.y * 0.01) * 0.1;
        } else {
          node.activation = Math.max(0.1, node.activation - 0.02);
        }
      });

      // Draw connections
      connections.forEach(conn => {
        const activation = Math.min(conn.from.activation, conn.to.activation);
        ctx.beginPath();
        ctx.moveTo(conn.from.x, conn.from.y);
        ctx.lineTo(conn.to.x, conn.to.y);

        if (activation > 0.5) {
          const gradient = ctx.createLinearGradient(conn.from.x, conn.from.y, conn.to.x, conn.to.y);
          gradient.addColorStop(0, `hsla(189, 100%, 50%, ${activation * 0.5})`);
          gradient.addColorStop(0.5, `hsla(270, 100%, 65%, ${activation * 0.4})`);
          gradient.addColorStop(1, `hsla(155, 100%, 50%, ${activation * 0.5})`);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 1.5 * activation;
        } else {
          ctx.strokeStyle = `hsla(210, 30%, 40%, ${0.1 + activation * 0.2})`;
          ctx.lineWidth = 0.5;
        }
        ctx.stroke();
      });

      // Draw data flow particles along connections
      if (activeLayer >= 0) {
        connections.forEach(conn => {
          const activation = Math.min(conn.from.activation, conn.to.activation);
          if (activation > 0.5) {
            const t = (timeRef.current * 2 + conn.from.x * 0.01) % 1;
            const px = conn.from.x + (conn.to.x - conn.from.x) * t;
            const py = conn.from.y + (conn.to.y - conn.from.y) * t;
            ctx.beginPath();
            ctx.arc(px, py, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(189, 100%, 70%, ${activation * 0.8})`;
            ctx.fill();
          }
        });
      }

      // Draw nodes
      nodes.forEach(node => {
        // Outer glow
        if (node.activation > 0.4) {
          const glowGrad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 4);
          const hue = node.layer <= 1 ? 189 : node.layer <= 3 ? 270 : 155;
          glowGrad.addColorStop(0, `hsla(${hue}, 100%, 60%, ${node.activation * 0.3})`);
          glowGrad.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius * 4, 0, Math.PI * 2);
          ctx.fillStyle = glowGrad;
          ctx.fill();
        }

        // Node body
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        const hue = node.layer <= 1 ? 189 : node.layer <= 3 ? 270 : 155;
        ctx.fillStyle = `hsla(${hue}, 100%, ${50 + node.activation * 20}%, ${0.3 + node.activation * 0.7})`;
        ctx.fill();

        // Node border
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${node.activation * 0.6})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animRef.current);
  }, [activeLayer]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-xl"
        style={{ imageRendering: "auto" }}
      />
      <div className="absolute bottom-2 left-3 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
        Neural Processing Network
      </div>
    </div>
  );
}
