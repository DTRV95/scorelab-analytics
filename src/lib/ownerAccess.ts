// Model Lab exposes raw calibration internals (Brier score, ML readiness,
// overconfidence index...) that mean nothing to a regular bettor and clash
// with the simple, betslip-style experience the rest of the app is moving
// towards, so nothing in the app links to it any more — no sidebar entry, no
// thumb-bar slot, no command palette row, no dashboard shortcut.
//
// None of that touches the calibration itself. The lab is a read-only view:
// the model is rebuilt from the tracked history wherever it is needed (every
// analysis, the value radar, the dashboard), whether or not anyone ever opens
// the page. This only decides who may open it by typing the URL.
const OWNER_EMAIL = "davidvilaverde@hotmail.com";

export function isOwnerEmail(email?: string | null): boolean {
  return (email ?? "").trim().toLowerCase() === OWNER_EMAIL;
}
