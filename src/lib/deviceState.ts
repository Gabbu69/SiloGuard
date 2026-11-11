export function freshness(receivedAt: string | null, now: number) {
  if (!receivedAt || !Number.isFinite(Date.parse(receivedAt))) return 'offline';
  const age = now - Date.parse(receivedAt);
  if (age < -5000 || age >= 120000) return 'offline';
  return age >= 15000 ? 'stale' : 'fresh';
}

export function commandState(requestedAt?: string, acknowledgedAt?: string | null) {
  if (!requestedAt || !Number.isFinite(Date.parse(requestedAt))) return 'No command requested';
  // Both fields are returned by PostgreSQL in its canonical timestamp format.
  // Keep microsecond precision; Date.parse would collapse distinct commands.
  return acknowledgedAt === requestedAt
    ? 'Device acknowledged the command' : 'Command requested · awaiting device acknowledgment';
}
