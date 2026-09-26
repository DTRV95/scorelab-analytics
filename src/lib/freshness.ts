/** How long ago something was fetched, in words. */
export function freshness(at: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - at) / 60000));
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "há 1 hora" : `há ${hours} horas`;
}
