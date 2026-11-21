import { useEffect, useRef } from 'react';

interface NodePoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isAccent: boolean;
  size: number;
}

export function InfrastructureCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationId = 0;
    let pointerX = -9999;
    let pointerY = -9999;
    let nodes: NodePoint[] = [];

    const initNodes = () => {
      const count = width < 768 ? 28 : 54;
      nodes = Array.from({ length: count }, (_, idx) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        isAccent: idx % 7 === 0,
        size: idx % 7 === 0 ? 2.4 : 1.5,
      }));
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initNodes();
    };

    const drawIXGeometry = (offsetX: number, offsetY: number) => {
      const cx = width * 0.72 + offsetX * 18;
      const cy = height * 0.48 + offsetY * 18;
      const scale = Math.min(width, height) * 0.34;

      if (width < 640) return;

      ctx.save();
      ctx.translate(cx, cy);

      // Subtle architectural diamond/crosshair rings
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(-scale * 0.9, -scale * 0.9, scale * 1.8, scale * 1.8);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(174, 221, 0, 0.14)';
      ctx.beginPath();
      ctx.moveTo(-scale, -scale);
      ctx.lineTo(scale, scale);
      ctx.moveTo(scale, -scale);
      ctx.lineTo(-scale, scale);
      ctx.stroke();

      // IX Structural Vectors
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-scale * 0.55, -scale * 0.48);
      ctx.lineTo(-scale * 0.55, scale * 0.48);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(174, 221, 0, 0.32)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-scale * 0.2, -scale * 0.48);
      ctx.lineTo(scale * 0.55, scale * 0.48);
      ctx.moveTo(scale * 0.55, -scale * 0.48);
      ctx.lineTo(-scale * 0.2, scale * 0.48);
      ctx.stroke();

      // Architectural corner ticks
      const tick = 14;
      ctx.strokeStyle = 'rgba(174, 221, 0, 0.45)';
      ctx.lineWidth = 1.5;
      const corners = [
        [-scale * 0.9, -scale * 0.9, 1, 1],
        [scale * 0.9, -scale * 0.9, -1, 1],
        [-scale * 0.9, scale * 0.9, 1, -1],
        [scale * 0.9, scale * 0.9, -1, -1],
      ];
      for (const [x, y, dx, dy] of corners) {
        ctx.beginPath();
        ctx.moveTo(x, y + dy * tick);
        ctx.lineTo(x, y);
        ctx.lineTo(x + dx * tick, y);
        ctx.stroke();
      }

      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Perspective base grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      const step = width < 768 ? 48 : 72;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const normX = pointerX > 0 ? pointerX / width - 0.5 : 0;
      const normY = pointerY > 0 ? pointerY / height - 0.5 : 0;
      drawIXGeometry(normX, normY);

      const maxDist = width < 768 ? 110 : 155;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!prefersReducedMotion) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > width) n.vx *= -1;
          if (n.y < 0 || n.y > height) n.vy *= -1;
        }

        // Connect neighboring nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const dx = n.x - m.x;
          const dy = n.y - m.y;
          const dist = Math.hypot(dx, dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * (n.isAccent || m.isAccent ? 0.24 : 0.09);
            ctx.strokeStyle =
              n.isAccent || m.isAccent
                ? `rgba(174, 221, 0, ${alpha.toFixed(3)})`
                : `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }

        // Subtle interactive pointer link
        if (pointerX > 0 && pointerY > 0) {
          const pd = Math.hypot(n.x - pointerX, n.y - pointerY);
          if (pd < 180) {
            ctx.strokeStyle = `rgba(174, 221, 0, ${((1 - pd / 180) * 0.28).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(pointerX, pointerY);
            ctx.stroke();
          }
        }

        ctx.fillStyle = n.isAccent ? '#AEDD00' : 'rgba(255, 255, 255, 0.45)';
        ctx.fillRect(n.x - n.size / 2, n.y - n.size / 2, n.size, n.size);
      }

      if (!prefersReducedMotion) {
        animationId = requestAnimationFrame(render);
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = e.clientX - rect.left;
      pointerY = e.clientY - rect.top;
    };

    const handlePointerLeave = () => {
      pointerX = -9999;
      pointerY = -9999;
    };

    resize();
    render();

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('mouseleave', handlePointerLeave);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseleave', handlePointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
