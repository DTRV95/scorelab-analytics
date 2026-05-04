import { useEffect, useMemo, useState } from "react";

const particles = Array.from({ length: 9 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 17) % 86)}%`,
  top: `${10 + ((index * 23) % 78)}%`,
  delay: `${-(index * 0.55)}s`,
  duration: `${10 + (index % 7) * 1.5}s`,
}));

export function PremiumAtmosphere() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  const visibleParticles = useMemo(() => {
    if (prefersReducedMotion) return [];
    const hardwareConcurrency = navigator.hardwareConcurrency || 8;
    return hardwareConcurrency <= 4 ? particles.slice(0, 4) : particles;
  }, [prefersReducedMotion]);

  return (
    <>
      <div className="scorelab-holo-noise pointer-events-none fixed inset-0 -z-10" />
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {visibleParticles.map((particle) => (
          <span
            key={particle.id}
            className="scorelab-data-particle absolute"
            style={{
              left: particle.left,
              top: particle.top,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
            }}
          />
        ))}
      </div>
      <div className="scorelab-premium-vignette pointer-events-none fixed inset-0 -z-10" />
    </>
  );
}
