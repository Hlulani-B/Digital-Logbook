import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getActivities } from "@/functions/activity.js";
import { askAI } from "@/functions/ai.js";
import { getToneInstruction } from "@/functions/tone";

type Activity = {
  id: number;
  action_type: string;
  entity_type: string;
  entity_name: string;
  details: Record<string, unknown>;
  created_at: string;
};

/** Parse AI response — handles JSON {"message":"..."} or plain text */
function parseAIResponse(response: string): string {
  try {
    const parsed = JSON.parse(response);
    return parsed.message || response;
  } catch {
    return response;
  }
}

/**
 * ActivitySummary — AI-generated summary of recent activity.
 * Renders above the activity feed without modifying it.
 */
export function ActivitySummary() {
  const { user } = useAuth();
  const email = user?.email || "";
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const result = await getActivities(email, 50);
        const activities: Activity[] = result?.data || [];

        if (activities.length === 0) {
          setSummary("No activity yet — start creating projects and logging entries!");
          return;
        }

        // Build a compact description of recent activity for the AI
        const actionCounts: Record<string, number> = {};
        const recentEntities: string[] = [];
        for (const a of activities.slice(0, 20)) {
          actionCounts[a.action_type] = (actionCounts[a.action_type] || 0) + 1;
          if (a.entity_name && recentEntities.length < 5) {
            recentEntities.push(a.entity_name);
          }
        }

        const actionSummary = Object.entries(actionCounts)
          .map(([action, count]) => `${action}: ${count}`)
          .join(", ");

        const tone = getToneInstruction();
        const prompt = `Summarize this user's recent activity in one friendly, conversational sentence (under 20 words). Actions: ${actionSummary}. Recent items: ${recentEntities.join(", ")}. ${tone}`;

        const aiResult = await askAI(prompt);
        if (!cancelled) {
          const msg = aiResult.success && aiResult.response ? parseAIResponse(aiResult.response) : "";
          setSummary(msg || "Here's what you've been up to recently.");
        }
      } catch (err) {
        console.error("[ActivitySummary] Error:", err);
        if (!cancelled) setSummary("Here's what you've been up to recently.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [email]);

  if (loading) {
    return (
      <div className="activity-summary animate-in">
        <p>Generating summary...</p>
      </div>
    );
  }

  return (
    <div className="activity-summary animate-in">
      <div className="activity-summary-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        <span>Activity Summary</span>
      </div>
      <p>{summary}</p>
    </div>
  );
}

export default ActivitySummary;
