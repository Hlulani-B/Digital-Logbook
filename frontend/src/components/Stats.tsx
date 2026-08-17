import { useMemo, useState } from "react";
import { calculateTotalTimeTracked } from "@/functions/dashboard/stats.js";

type Entry = Record<string, unknown>;
type Project = Record<string, unknown>;

interface StatsProps {
  entries: Entry[];
  projects: Project[];
  dueSoonCount: number;
}

export function Stats({ entries, projects, dueSoonCount }: StatsProps) {
  const [statsOpen, setStatsOpen] = useState(false);

  // Calculate total time tracked (including in-progress tasks)
  const totalTimeTracked = useMemo(() => {
    return calculateTotalTimeTracked(entries);
  }, [entries]);

  return (
    <div className="feed-stats-box">
      {statsOpen ? (
        <div className="feed-stats-panel">
          <div className="feed-stats-panel-header">
            <span className="feed-stats-panel-title">Quick Stats</span>
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
          </div>
        </div>
      ) : (
        <button className="feed-stats-btn" onClick={() => setStatsOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          View Stats
        </button>
      )}
    </div>
  );
}

export default Stats;
