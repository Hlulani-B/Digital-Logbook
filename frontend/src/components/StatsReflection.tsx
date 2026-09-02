import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getProjectsByEmail } from '@/functions/project/project.js';
import { sortUnarchivedEntries } from '@/functions/project/entries.js';
import { askAI } from '@/functions/ai.js';
import { getToneInstruction } from '@/functions/tone';

type Entry = Record<string, unknown>;
type Project = Record<string, unknown>;

/** Parse AI response — handles JSON or plain text */
function parseAIResponse(response: string): string {
  try {
    const parsed = JSON.parse(response);
    if (typeof parsed === 'string') return parsed;
    if (typeof parsed === 'object' && parsed !== null) {
      for (const key of ['message', 'instruction', 'response', 'text', 'content', 'reply']) {
        if (typeof parsed[key] === 'string') return parsed[key];
      }
      for (const val of Object.values(parsed)) {
        if (typeof val === 'string') return val;
      }
    }
    return response;
  } catch {
    return response;
  }
}

/**
 * StatsReflection — AI-powered quick insight about recent activity.
 * Lightweight, non-intrusive component for the dashboard.
 */
export function StatsReflection() {
  const { user } = useAuth();
  const email = user?.email || '';
  const [reflection, setReflection] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Fetch recent data
        const [projectsRes, entriesRes] = await Promise.allSettled([
          getProjectsByEmail(email),
          sortUnarchivedEntries(email, null, 0),
        ]);

        const projects: Project[] =
          projectsRes.status === 'fulfilled' ? projectsRes.value?.projects || [] : [];
        const entries: Entry[] =
          entriesRes.status === 'fulfilled' ? entriesRes.value?.data || [] : [];

        if (entries.length === 0 && projects.length === 0) {
          setReflection('No activity yet — start by creating your first project!');
          return;
        }

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
${topProject ? `- Most active project this week: ${topProject[0]} (${topProject[1]} entries)` : ''}

Make it insightful and encouraging. ${tone}`;

        const aiResult = await askAI(prompt);
        if (!cancelled) {
          const msg =
            aiResult.success && aiResult.response ? parseAIResponse(aiResult.response) : '';
          setReflection(msg || "Here's a quick look at your progress.");
        }
      } catch (err) {
        console.error('[StatsReflection] Error:', err);
        if (!cancelled) setReflection("Here's a quick look at your progress.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email]);

  if (loading || !reflection) return null;

  return (
    <div className="stats-reflection animate-in">
      <p>{reflection}</p>
    </div>
  );
}

export default StatsReflection;
