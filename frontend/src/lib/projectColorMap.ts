/**
 * Build a project-name → colour map from a cached projects list.
 * Used to give every entry a subtle left-border accent matching its project.
 *
 * @param projects - Array of project objects (must have project_name; optional project_color)
 * @returns Record mapping project_name → hex colour string (or null if no colour set)
 */
export function buildProjectColorMap(
  projects: Array<Record<string, unknown>>
): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const p of projects) {
    const name = p.project_name as string;
    if (name) {
      map[name] = (p.project_color as string) || null;
    }
  }
  return map;
}

/** Fallback hash-based colour when no custom colour is set */
const TAB_COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];

export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return TAB_COLORS[Math.abs(hash) % TAB_COLORS.length];
}

/** Resolve the colour for a project — custom colour first, then hash fallback */
export function resolveProjectColor(
  projectName: string,
  colorMap: Record<string, string | null>
): string {
  return colorMap[projectName] || colorForName(projectName);
}
