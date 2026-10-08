/**
 * A line across the top, while something is on its way.
 *
 * The app had two full-screen waiting states — one for the stored analyses,
 * one for the session — both of them a card in the middle of an empty page,
 * both in English, and on a cold open somebody saw them one after the other
 * before anything of their own appeared. This is what replaced them: the page
 * underneath stays where it is, and the only thing that moves is a hairline.
 */
export function RouteProgress({ label = "A abrir" }: { label?: string }) {
  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-transparent"
      role="status"
      aria-label={label}
    >
      <div className="sl-route-progress h-full w-1/3 [background:var(--sl-gradient)]" />
    </div>
  );
}
