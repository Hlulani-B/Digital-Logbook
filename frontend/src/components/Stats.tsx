import { useMemo, useState, useEffect } from "react";
import { calculateTotalTimeTracked, calculateProjectStats } from "@/functions/dashboard/stats.js";
import { askAI } from "@/functions/ai.js";
import { getToneInstruction } from "@/functions/tone";

type Entry = Record<string, unknown>;
type Project = Record<string, unknown>;

interface StatsProps {
  entries: Entry[];
  projects: Project[];
  dueSoonCount: number;
  /** When set, show stats scoped to this project name */
  activeProject?: string;
}

export function Stats({ entries, projects, dueSoonCount, activeProject }: StatsProps) {
  const [statsOpen, setStatsOpen] = useState(false);
  const [reflection, setReflection] = useState("");

  // Generate AI reflection when stats panel is opened
  useEffect(() => {
    if (!statsOpen || reflection || activeProject) return;

    const generateReflection = async () => {
      try {
        // Calculate quick stats
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const recentEntries = entries.filter((e) => {
          const created = new Date(e.created_at as string);
          return created >= weekAgo;
        });

        const projectCounts: Record<string, number> = {};
        recentEntries.forEach((e) => {
          const name = e.project_name as string;
          projectCounts[name] = (projectCounts[name] || 0) + 1;
        });

        const topProject = Object.entries(projectCounts).sort((a, b) => b[1] - a[1])[0];
        const totalEntries = entries.length;
        const weekEntries = recentEntries.length;

        // Build prompt for AI
        const tone = getToneInstruction();
        const prompt = `Generate a brief, friendly stats reflection (under 25 words) for a user with:
- ${totalEntries} total entries
- ${weekEntries} entries in the past week
- ${projects.length} projects
${topProject ? `- Most active project this week: ${topProject[0]} (${topProject[1]} entries)` : ""}

Make it insightful and encouraging. ${tone}`;

        const aiResult = await askAI(prompt);
        console.log("[Stats] AI result:", aiResult);
        if (aiResult.success && aiResult.response) {
          // Parse AI response
          try {
            const parsed = JSON.parse(aiResult.response);
            if (typeof parsed === "object" && parsed !== null) {
              for (const key of ["message", "instruction", "response", "text", "content", "reply"]) {
                if (typeof parsed[key] === "string") {
                  setReflection(parsed[key]);
                  return;
                }
              }
              for (const val of Object.values(parsed)) {
                if (typeof val === "string") {
                  setReflection(val);
                  return;
                }
              }
            }
            setReflection(aiResult.response);
          } catch {
            setReflection(aiResult.response);
          }
        } else {
          // Fallback if AI fails
          setReflection(
            topProject
              ? `You've got ${totalEntries} entries across ${projects.length} projects. ${topProject[0]} is leading with ${topProject[1]} entries this week — keep it up!`
              : `You've got ${totalEntries} entries across ${projects.length} projects. Log more this week to build momentum!`
          );
        }
      } catch (err) {
        console.error("[Stats] Reflection error:", err);
        // Fallback on error
        const totalEntries = entries.length;
        const topProject = projects.length > 0 ? projects[0] : null;
        setReflection(
          topProject
            ? `You've got ${totalEntries} entries across ${projects.length} projects. ${(topProject as any).project_name} is your most active — nice work!`
            : `You've got ${totalEntries} entries across ${projects.length} projects. Keep logging to build your streak!`
        );
      }
    };

    generateReflection();
  }, [statsOpen, reflection, activeProject, entries, projects]);

  // Calculate total time tracked (including in-progress tasks)
  const totalTimeTracked = useMemo(() => {
    return calculateTotalTimeTracked(entries);
  }, [entries]);

  // Per-project breakdown
  const projectStats = useMemo(() => {
    return calculateProjectStats(entries);
  }, [entries]);

  // Stats scoped to the active project
  const activeProjectStats = useMemo(() => {
    if (!activeProject) return null;
    return projectStats.find((s) => s.project_name === activeProject) || null;
  }, [projectStats, activeProject]);

  const activeProjectEntries = useMemo(() => {
    if (!activeProject) return [];
    return entries.filter((e) => e.project_name === activeProject);
  }, [entries, activeProject]);

  return (
    <div className="feed-stats-box">
      {statsOpen ? (
        <div className="feed-stats-panel">
          <div className="feed-stats-panel-header">
            <span className="feed-stats-panel-title">
              {activeProject ? `${activeProject} — Stats` : "Quick Stats"}
            </span>
            <button
              className="feed-stats-panel-close"
              onClick={() => setStatsOpen(false)}
              aria-label="Close stats"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="feed-stats-panel-body">
            {activeProject && activeProjectStats ? (
              <>
                <div className="feed-stat-item">
                  <span className="feed-stat-value">{activeProjectEntries.length}</span>
                  <span className="feed-stat-label">Entries</span>
                </div>
                <div className="feed-stat-item">
                  <span className="feed-stat-value">{activeProjectStats.display}</span>
                  <span className="feed-stat-label">
                    Total Time
                    {activeProjectStats.inProgressCount > 0 && (
                      <span style={{ fontSize: "0.7rem", opacity: 0.7, marginLeft: "0.25rem" }}>
                        ({activeProjectStats.inProgressCount} in progress)
                      </span>
                    )}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="feed-stat-item">
                  <span className="feed-stat-value">{entries.length}</span>
                  <span className="feed-stat-label">Total Entries</span>
                </div>
                <div className="feed-stat-item">
                  <span className="feed-stat-value">{projects.length}</span>
                  <span className="feed-stat-label">Projects</span>
                </div>
                <div className="feed-stat-item">
                  <span className="feed-stat-value">{dueSoonCount}</span>
                  <span className="feed-stat-label">Due Soon</span>
                </div>
                <div className="feed-stat-item">
                  <span className="feed-stat-value">{totalTimeTracked.display}</span>
                  <span className="feed-stat-label">
                    Time Tracked
                    {totalTimeTracked.inProgressCount > 0 && (
                      <span style={{ fontSize: "0.7rem", opacity: 0.7, marginLeft: "0.25rem" }}>
                        ({totalTimeTracked.inProgressCount} in progress)
                      </span>
                    )}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Cross-project breakdown (AT3) — shown when no single project is selected */}
          {!activeProject && projectStats.length > 0 && (
            <div className="feed-stats-breakdown">
              <span className="feed-stats-breakdown-title">Time per Project</span>
              {projectStats.map((ps) => (
                <div key={ps.project_name} className="feed-stats-breakdown-row">
                  <span className="feed-stats-breakdown-name">{ps.project_name}</span>
                  <span className="feed-stats-breakdown-detail">
                    {ps.display} · {ps.entryCount} entr{ps.entryCount === 1 ? "y" : "ies"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* AI Reflection — shown when no single project is selected */}
          {!activeProject && reflection && (
            <>
              <div className="feed-stats-divider" />
              <div className="feed-stats-reflection">
                <p>{reflection}</p>
              </div>
            </>
          )}
        </div>
      ) : (
        <button className="feed-stats-btn" onClick={() => setStatsOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          {activeProject ? "Project Stats" : "View Stats"}
        </button>
      )}
    </div>
  );
}

export default Stats;
