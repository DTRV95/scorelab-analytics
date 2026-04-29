import { useEffect } from "react";

const particles = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 17) % 86)}%`,
  top: `${10 + ((index * 23) % 78)}%`,
  delay: `${-(index * 0.55)}s`,
  duration: `${10 + (index % 7) * 1.5}s`,
}));

export function PremiumAtmosphere() {
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const x = `${(event.clientX / window.innerWidth) * 100}%`;
      const y = `${(event.clientY / window.innerHeight) * 100}%`;

      document.documentElement.style.setProperty("--scorelab-pointer-x", x);
      document.documentElement.style.setProperty("--scorelab-pointer-y", y);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return (
    <>
      <div className="scorelab-cursor-glow pointer-events-none fixed inset-0 -z-10" />
      <div className="scorelab-holo-noise pointer-events-none fixed inset-0 -z-10" />
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {particles.map((particle) => (
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
