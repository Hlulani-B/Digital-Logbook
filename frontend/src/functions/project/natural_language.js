import { request } from "../api";

const PROJECT_SERVICE_URL = import.meta.env.VITE_PROJECT_SERVICE_URL || "https://digital-logbook-project-service.onrender.com";

export async function addNaturalLanguageEntry(text) {
  try {
    const response = await request(`${PROJECT_SERVICE_URL}/service/natural-language-entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, message: errorData.message || errorData.error || "Failed to create entry" };
    }
  } catch (error) {
    console.error("Error in addNaturalLanguageEntry:", error);
    return { success: false, message: "Network error. Please try again." };
  }
}
