import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { motion } from "framer-motion";

/**
 * Moving between pages.
 *
 * Two things were missing and both of them read as the app stuttering. The
 * pages were wrapped in an AnimatePresence that never saw them change — the
 * routes carried no key, so every page swapped with no transition at all. And
 * a new page arrived at whatever scroll position the last one was left at, so
 * tapping a challenge from halfway down Início opened it halfway down.
 *
 * The transition is deliberately short and enter-only: a page that fades out
 * before the next fades in doubles the wait on every tap, and on a phone that
 * is the difference between an app and a website.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // Going back should land where it was left: the browser restores that
    // itself, and jumping to the top would undo it.
    if (navigationType === "POP") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, navigationType]);

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
