'use client';

import { useEffect, useRef, useCallback } from 'react';

export default function CanvasBackground() {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const mouseRef      = useRef({ x: -999, y: -999 });
  const animRef       = useRef<number>(0);
  const rafPendingRef = useRef(false); // throttle mousemove to 1× per frame

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

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize',    resize,      { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // 35 particles — balanced between visual richness and scroll performance
    type Particle = { x: number; y: number; vx: number; vy: number; r: number; opacity: number };
    const particles: Particle[] = Array.from({ length: 45 }, () => ({
      x:       Math.random() * canvas.width,
      y:       Math.random() * canvas.height,
      vx:      (Math.random() - 0.5) * 0.4,
      vy:      (Math.random() - 0.5) * 0.4,
      r:       Math.random() * 2.0 + 1.0,
      opacity: Math.random() * 0.5 + 0.2,
    }));

    const LINK_DIST  = 130;
    const MOUSE_DIST = 100;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Move particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }

      // Draw connection lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            // Eye-catching vibrant cyan-blue
            ctx.strokeStyle = `rgba(0, 150, 255, ${0.15 * (1 - d / LINK_DIST)})`;
            ctx.lineWidth   = 1.2;
            ctx.stroke();
          }
        }
        // Mouse attraction lines
        const dx = particles[i].x - mx;
        const dy = particles[i].y - my;
        const dm = Math.sqrt(dx * dx + dy * dy);
        if (dm < MOUSE_DIST) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mx, my);
          // Stronger interaction line
          ctx.strokeStyle = `rgba(0, 150, 255, ${0.4 * (1 - dm / MOUSE_DIST)})`;
          ctx.lineWidth   = 1.5;
          ctx.stroke();
        }
      }

      // Draw dots
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 150, 255, ${p.opacity})`;
        ctx.fill();
      }

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
