import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Launching the app lands on Início, wherever the shortcut points.
 *
 * An icon on a phone's home screen remembers the address it was created at.
 * A shortcut added while looking at a challenge opens on that challenge for
 * the rest of its life, and the manifest's start_url only governs shortcuts
 * made after it existed — so saying "it opens at /" fixed nothing for the
 * icon already on the screen.
 *
 * Installed, the app launch is not a link being followed: nothing outside
 * opens in it (a link tapped elsewhere goes to the browser), so the address
 * it starts at is either where the icon was made or where the app was left.
 * Neither is a destination anybody chose today, and Início is.
 *
 * In an ordinary browser tab this does nothing at all. There the address is
 * a choice — a challenge somebody was sent, a page somebody bookmarked on
 * purpose — and hijacking it would break every link the app can produce.
 */

/** Once per launch: navigating inside the app afterwards is nobody's business. */
const LAUNCHED = "scorelab_launch_handled";

/** Addresses that are the whole point of the visit, even on a launch. */
const KEEP = ["/reset-password", "/forgot-password"];

function isInstalled(): boolean {
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
    // Safari on iOS, which predates the standard and never adopted it.
    return (
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
    );
  } catch {
    return false;
  }
}

export function OpenOnHome({ home = "/dashboard" }: { home?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  // The decision belongs to the first render of a launch, not to every
  // change of address afterwards.
  const decided = useRef(false);

  useEffect(() => {
    if (decided.current) return;
    decided.current = true;

    if (!isInstalled()) return;

    try {
      // Backgrounding and returning is not a launch: the page is still the
      // one that was left, and sending it home would throw away whatever was
      // on screen. Only a cold start has an empty session store.
      if (sessionStorage.getItem(LAUNCHED)) return;
      sessionStorage.setItem(LAUNCHED, "1");
    } catch {
      // Private browsing, or storage turned off. Without a way to tell one
      // launch from the next, leave the address alone.
      return;
    }

    const { pathname, hash } = location;
    if (pathname === home || pathname === "/") return;
    if (KEEP.some((kept) => pathname.startsWith(kept))) return;
    // An address carrying a token is a link being completed, not a launch.
    if (hash.includes("access_token") || hash.includes("type=recovery")) return;

    navigate(home, { replace: true });
  }, [home, location, navigate]);

  return null;
}
