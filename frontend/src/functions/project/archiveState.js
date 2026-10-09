// ── Effective project archive state ─────────────────────────────
// A project is effectively archived when the server `archived` flag is set
// OR when the Dashboard's legacy localStorage fallback lists it — the
// Dashboard persists there because the project UPDATE can be blocked by
// RLS (see Dashboard handleArchiveProject). Every surface that derives
// eligibility from project archive state must read the state through this
// module so Due Soon counts and lists agree everywhere.

const keyFor = (userEmail) => `dl_archived_${userEmail}`;

/**
 * Names the Dashboard archived locally, persisted in localStorage when the
 * server-side archive update could not be written. Always returns a Set of
 * project-name strings, even for malformed stored data.
 */
export function getLocallyArchivedProjectNames(userEmail) {
  if (!userEmail) return new Set();
  try {
    const stored = localStorage.getItem(keyFor(userEmail));
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((name) => typeof name === 'string'));
  } catch {
    return new Set();
  }
}

/**
 * Effective archived project names for the given cached PROJECTS rows:
 * server `archived` flag OR the localStorage fallback. The returned Set can
 * be handed straight to computeDueSoon / isDueSoon as projectArchived.
 */
export function getEffectiveArchivedProjectNames(userEmail, projects = []) {
  const local = getLocallyArchivedProjectNames(userEmail);
  const effective = new Set();
  for (const project of Array.isArray(projects) ? projects : []) {
    const name = project?.project_name;
    if (name != null && (project?.archived === true || local.has(name))) {
      effective.add(name);
    }
  }
  return effective;
}
