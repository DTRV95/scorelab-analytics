// Model Lab exposes raw calibration internals (Brier score, ML readiness,
// overconfidence index...) that mean nothing to a regular bettor and clash
// with the simple, betslip-style experience the rest of the app is moving
// towards. It keeps running and self-calibrating in the background either
// way (it just reads the same tracked analyses History already collects) —
// this only decides who gets a UI to look at it.
const OWNER_EMAIL = "davidvilaverde@hotmail.com";

export function isOwnerEmail(email?: string | null): boolean {
  return (email ?? "").trim().toLowerCase() === OWNER_EMAIL;
}
