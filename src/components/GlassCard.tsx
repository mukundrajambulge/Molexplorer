import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  accentColor?: 'cyan' | 'amber' | 'violet' | 'emerald';
  tiltIntensity?: number;
  glowOnHover?: boolean;
  chamfered?: boolean;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  accentColor = 'cyan',
  tiltIntensity = 12,
  glowOnHover = true,
  chamfered = false,
  onClick
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rX = ((y - centerY) / centerY) * -tiltIntensity;
    const rY = ((x - centerX) / centerX) * tiltIntensity;

    setRotateX(rX);
    setRotateY(rY);
    setMousePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100
    });
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  const accentBorderStyles = {
    cyan: 'hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(0,242,255,0.25)]',
    amber: 'hover:border-amber-400/50 hover:shadow-[0_0_25px_rgba(242,125,38,0.25)]',
    violet: 'hover:border-violet-400/50 hover:shadow-[0_0_25px_rgba(139,92,246,0.25)]',
    emerald: 'hover:border-emerald-400/50 hover:shadow-[0_0_25px_rgba(16,185,129,0.25)]'
  };

  const accentRadialColors = {
    cyan: 'rgba(0, 242, 255, 0.12)',
    amber: 'rgba(242, 125, 38, 0.12)',
    violet: 'rgba(139, 92, 246, 0.12)',
    emerald: 'rgba(16, 185, 129, 0.12)'
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transformStyle: 'preserve-3d',
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(${isHovered ? '8px' : '0px'})`,
        transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      className={`
        relative overflow-hidden rounded-xl border border-white/10 bg-slate-950/70 p-6 backdrop-blur-xl
        ${glowOnHover ? accentBorderStyles[accentColor] : ''}
        ${chamfered ? 'hud-clip' : ''}
        ${className}
      `}
    >
      {/* Interactive mouse spotlight glow */}
      {isHovered && (
        <div
          className="pointer-events-none absolute -inset-px opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(400px circle at ${mousePos.x}% ${mousePos.y}%, ${accentRadialColors[accentColor]}, transparent 70%)`
          }}
        />
      )}

      {/* Decorative HUD corners */}
      <div className="pointer-events-none absolute top-0 left-0 h-2 w-2 border-t border-l border-cyan-400/40" />
      <div className="pointer-events-none absolute top-0 right-0 h-2 w-2 border-t border-r border-cyan-400/40" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-2 w-2 border-b border-l border-cyan-400/40" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-2 w-2 border-b border-r border-cyan-400/40" />

      {/* Card Content with 3D depth */}
      <div style={{ transform: 'translateZ(15px)' }} className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};
