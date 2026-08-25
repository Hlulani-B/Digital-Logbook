import { searchProject } from "@/functions/dashboard/search.js";

/**
 * Search entries within a specific project only.
 * Wraps the shared searchProject function for use on the Project detail page.
 */
export async function searchEntriesInProject(
  user_email,
  project_name,
  keyword
) {
  if (!keyword.trim()) return null;
  return searchProject(user_email, project_name, keyword.trim());
}
