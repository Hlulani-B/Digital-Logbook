export const AUTH_URL = import.meta.env.VITE_AUTH_SERVICE_URL;
export const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_SERVICE_URL;
export const PROJECT_URL =
  import.meta.env.VITE_PROJECT_SERVICE_URL || "https://project-service-96ml.onrender.com";
export const PROFILE_URL =
  import.meta.env.VITE_PROFILE_SERVICE_URL || "https://profile-service-0zk7.onrender.com";

export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const { supabase } = await import("./supabase");
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || "";

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    health: () => request<{ service: string; status: string }>(`${AUTH_URL}`),
  },
  dashboard: {
    health: () =>
      request<{ service: string; status: string }>(`${DASHBOARD_URL}`),
  },
  projects: {
    health: () =>
      request<{ service: string; status: string }>(`${PROJECT_URL}`),
  },
};
