import { request, PROJECT_URL } from "../../lib/api";

export async function addNaturalLanguageEntry(text) {
  try {
    const data = await request(`${PROJECT_URL}/service/natural-language-entry`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });

    return { success: true, data };
  } catch (error) {
    console.error("Error in addNaturalLanguageEntry:", error);
    return { success: false, message: error.message || "Network error. Please try again." };
  }
}
