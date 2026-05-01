'use client';

import { useEffect, useRef, useCallback } from 'react';

type Particle = { x: number; y: number; vx: number; vy: number; r: number; opacity: number };

function makeParticles(count: number, w: number, h: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x:       Math.random() * w,
    y:       Math.random() * h,
    vx:      (Math.random() - 0.5) * 0.4,
    vy:      (Math.random() - 0.5) * 0.4,
    r:       Math.random() * 2.0 + 1.0,
    opacity: Math.random() * 0.5 + 0.2,
  }));
}

export default function CanvasBackground() {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const mouseRef      = useRef({ x: -999, y: -999 });
  const animRef       = useRef<number>(0);
  const rafPendingRef = useRef(false); // throttle mousemove to 1× per frame
  const particlesRef  = useRef<Particle[]>([]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!rafPendingRef.current) {
      rafPendingRef.current = true;
      requestAnimationFrame(() => {
        mouseRef.current = { x: e.clientX, y: e.clientY };
        rafPendingRef.current = false;
      });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const PARTICLE_COUNT = 45;
    const LINK_DIST     = 130;
    const MOUSE_DIST    = 100;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      // Fix #2: re-scatter particles whenever the viewport changes so every
      // area of the new size is populated immediately (no empty corner on rotation).
      particlesRef.current = makeParticles(PARTICLE_COUNT, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize',    resize,      { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const mx  = mouseRef.current.x;
      const my  = mouseRef.current.y;
      const pts = particlesRef.current;

      // Move particles — bounce off edges
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width)  p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      }

      // Fix #14 — Draw ALL connection lines in one batched path instead of
      // one stroke() call per pair.  Opacity still varies per segment, so
      // we can't trivially batch across different alpha values, but grouping
      // all segments at the same approximate alpha (binned to 0.05 steps)
      // reduces GPU draw calls from O(N²) → O(buckets) ≈ 20 max.
      //
      // Practical shortcut that is good enough and stays simple:
      // draw particle-to-particle lines in one pass (all the same color,
      // alpha encoded as a function that we accept varies slightly — the
      // eye doesn't notice the small per-segment alpha difference at this scale).
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST) {
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
          }
        }
      }
      ctx.strokeStyle = 'rgba(0, 150, 255, 0.12)';
      ctx.lineWidth   = 1.2;
      ctx.stroke();

      // Mouse attraction lines — single batched path
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const dx = pts[i].x - mx;
        const dy = pts[i].y - my;
        const dm = Math.sqrt(dx * dx + dy * dy);
        if (dm < MOUSE_DIST) {
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(mx, my);
        }
      }
      ctx.strokeStyle = 'rgba(0, 150, 255, 0.35)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Draw dots — single batched path (all same color)
      ctx.beginPath();
      for (const p of pts) {
        ctx.moveTo(p.x + p.r, p.y);
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      }
      ctx.fillStyle = 'rgba(0, 150, 255, 0.45)';
      ctx.fill();

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize',    resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [onMouseMove]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.9,
        willChange: 'transform', // own GPU compositor layer — won't block scroll
      }}
    />
  );
}
