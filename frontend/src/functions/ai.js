import { request, PROJECT_URL } from "./lib/api";

/**
 * Send a prompt to the AI backend and get a response.
 * @param {string} prompt - The prompt/question to send to the AI
 * @returns {{ success: boolean, response?: string, message?: string }}
 */
export async function askAI(prompt) {
  try {
    const data = await request(`${PROJECT_URL}/service/ai`, {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });

    if (data?.success === false) {
      return { success: false, message: data.error || data.message || "AI request failed" };
    }

    return { success: true, response: data.response };
  } catch (error) {
    console.error("Error in askAI:", error);
    return { success: false, message: error.message || "Network error. Please try again." };
  }
}
