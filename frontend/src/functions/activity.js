import { request, PROJECT_URL } from "@/lib/api";

export async function getActivities(user_email, limit = 50) {
  return request(`${PROJECT_URL}/service/activity`, {
    method: "POST",
    body: JSON.stringify({
      function: "getActivities",
      values: { user_email, limit },
    }),
  });
}
