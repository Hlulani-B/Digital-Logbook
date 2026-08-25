import { useEffect, useRef } from 'react';

interface Ribbon {
  points: { x: number; y: number }[];
  speed: number;
  amplitude: number;
  frequency: number;
  offset: number;
  color: string;
  width: number;
  alpha: number;
}

const RIBBON_COLORS = [
  '#c9a96e', // warm gold
  '#d4b896', // soft amber
  '#a8b894', // sage
  '#e8d4c4', // cream
  '#d9b4a1', // dusty rose
  '#b89a7a', // muted bronze
];

export function AuroraRibbons() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ribbonsRef = useRef<Ribbon[]>([]);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const timeRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initRibbons(rect.width, rect.height);
    };

    const initRibbons = (width: number, height: number) => {
      const count = Math.max(5, Math.floor(height / 110));
      ribbonsRef.current = Array.from({ length: count }, (_, i) => {
        const t = i / Math.max(1, count - 1);
        return {
          points: Array.from({ length: 12 }, (_, j) => ({
            x: (j / 11) * width,
            y: height * (0.15 + t * 0.7) + (Math.random() - 0.5) * 60,
          })),
          speed: 0.0008 + Math.random() * 0.0012,
          amplitude: 30 + Math.random() * 60,
          frequency: 0.5 + Math.random() * 1.5,
          offset: Math.random() * Math.PI * 2,
          color: RIBBON_COLORS[i % RIBBON_COLORS.length],
          width: 60 + Math.random() * 90,
          alpha: 0.15 + Math.random() * 0.2,
        };
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Dark warm base
      const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
      baseGradient.addColorStop(0, '#161310');
      baseGradient.addColorStop(0.5, '#1c1915');
      baseGradient.addColorStop(1, '#12100d');
      ctx.fillStyle = baseGradient;
      ctx.fillRect(0, 0, width, height);

      timeRef.current += 1;
      const t = timeRef.current;
      const mouse = mouseRef.current;

      ribbonsRef.current.forEach((ribbon) => {
        const path = new Path2D();

        ribbon.points.forEach((pt, i) => {
          const x = (i / (ribbon.points.length - 1)) * width;

          // Layered sine motion for organic flow
          const wave1 = Math.sin(x * 0.003 * ribbon.frequency + t * ribbon.speed + ribbon.offset);
          const wave2 = Math.sin(x * 0.007 + t * ribbon.speed * 1.5 + ribbon.offset * 0.5);
          const wave3 = Math.sin(x * 0.0015 - t * ribbon.speed * 0.7);

          // Mouse influence — ribbons bend slightly away from cursor
          const dx = x / width - mouse.x;
          const dy = pt.y / height - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const mouseForce = Math.max(0, 1 - dist * 2.5) * 40;

          const y =
            pt.y +
            wave1 * ribbon.amplitude +
            wave2 * ribbon.amplitude * 0.4 +
            wave3 * ribbon.amplitude * 0.25 +
            (dy > 0 ? -mouseForce : mouseForce);

          if (i === 0) {
            path.moveTo(x, y);
          } else {
            // Smooth quadratic curves between points
            const prev = ribbon.points[i - 1];
            const prevX = ((i - 1) / (ribbon.points.length - 1)) * width;
            const prevWave1 = Math.sin(
              prevX * 0.003 * ribbon.frequency + t * ribbon.speed + ribbon.offset
            );
            const prevWave2 = Math.sin(
              prevX * 0.007 + t * ribbon.speed * 1.5 + ribbon.offset * 0.5
            );
            const prevWave3 = Math.sin(prevX * 0.0015 - t * ribbon.speed * 0.7);
            const prevY =
              prev.y +
              prevWave1 * ribbon.amplitude +
              prevWave2 * ribbon.amplitude * 0.4 +
              prevWave3 * ribbon.amplitude * 0.25;
            const cpX = (prevX + x) / 2;
            const cpY = (prevY + y) / 2;
            path.quadraticCurveTo(cpX, cpY, x, y);
          }
        });

        // Wide soft stroke for glowing ribbon look
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Outer glow
        ctx.shadowColor = ribbon.color;
        ctx.shadowBlur = ribbon.width * 0.8;
        ctx.strokeStyle = ribbon.color;
        ctx.globalAlpha = ribbon.alpha * 0.6;
        ctx.lineWidth = ribbon.width;
        ctx.stroke(path);

        // Inner bright core
        ctx.shadowBlur = 20;
        ctx.globalAlpha = ribbon.alpha;
        ctx.lineWidth = ribbon.width * 0.35;
        ctx.stroke(path);

        ctx.restore();
      });

      // Subtle vignette to focus attention on center/caption
      const vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        height * 0.3,
        width * 0.5,
        height * 0.5,
        height * 0.9
      );
      vignette.addColorStop(0, 'rgba(22,19,16,0)');
      vignette.addColorStop(1, 'rgba(22,19,16,0.55)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', handleMouseMove);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="aurora-ribbons"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
      }}
    />
  );
}
