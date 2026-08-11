import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface BorderBeamPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  beams?: number;
  duration?: number;
  hoverDuration?: number;
  thickness?: number;
  radius?: number;
  glow?: boolean;
  colorFrom?: string;
  colorTo?: string;
}

export const BorderBeamPanel: React.FC<BorderBeamPanelProps> = ({
  children,
  className,
  beams = 1,
  duration = 12,
  hoverDuration = 3,
  thickness = 1.5,
  radius = 0,
  glow = false,
  colorFrom = "#6366F1",
  colorTo = "#26262C",
  ...props
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  // IntersectionObserver to pause when out of view
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  // Determine current duration based on hover, visibility, and reduced motion
  const currentDuration = reducedMotion ? 0 : isHovered ? hoverDuration : duration;
  const isAnimating = isVisible && !reducedMotion;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden p-[1px] bg-zinc-800 transition-colors",
        className
      )}
      style={{
        borderRadius: `${radius}px`,
        padding: `${thickness}px`,
        ...props.style
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {/* Animated Beam Layer */}
      {isAnimating && (
        <div
          className="pointer-events-none absolute inset-[-50%] aspect-square min-w-[200%] min-h-[200%] animate-spin"
          style={{
            background: `conic-gradient(from 0deg, ${colorFrom}, ${colorTo}, transparent, transparent)`,
            animationDuration: `${currentDuration}s`,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            animationPlayState: isVisible ? "running" : "paused",
            transition: "animation-duration 0.8s cubic-bezier(0.25, 0.8, 0.25, 1)", // spring-like transition
            transformOrigin: "center center",
          }}
        />
      )}

      {/* Glow Layer if enabled */}
      {isAnimating && glow && (
        <div
          className="pointer-events-none absolute inset-[-50%] aspect-square min-w-[200%] min-h-[200%] animate-spin blur-md opacity-40"
          style={{
            background: `conic-gradient(from 0deg, ${colorFrom}, ${colorTo}, transparent, transparent)`,
            animationDuration: `${currentDuration}s`,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            animationPlayState: isVisible ? "running" : "paused",
            transition: "animation-duration 0.8s cubic-bezier(0.25, 0.8, 0.25, 1)",
            transformOrigin: "center center",
          }}
        />
      )}

      {/* Inner Content Panel */}
      <div
        className="relative w-full h-full bg-zinc-950 z-10"
        style={{
          borderRadius: `${Math.max(0, radius - thickness)}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
