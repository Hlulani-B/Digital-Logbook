const AUTH_URL = import.meta.env.VITE_AUTH_SERVICE_URL;
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_SERVICE_URL;
const PROJECT_URL = import.meta.env.VITE_PROJECT_SERVICE_URL;

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = (await import("./supabase")).supabase
    ? localStorage.getItem("sb-access-token") || ""
    : "";

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
