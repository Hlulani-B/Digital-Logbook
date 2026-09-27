export const GATEWAY_URL = (import.meta.env.VITE_API_GATEWAY_URL || '').replace(/\/+$/, '');

const SERVICES = ['auth', 'dashboard', 'project', 'profile'] as const;
type Service = (typeof SERVICES)[number];
type WakeResult = { service: Service; status: 'awake' | 'failed' };
type WakeResponse = { success: boolean; services: WakeResult[] };

// Allow the gateway itself and its backends to start before timing the operation.
const STARTUP_TIMEOUT_MS = 180_000;
const READY_TTL_MS = 60_000;
const readyAt = new Map<Service, number>();
const pending = new Map<Service, Promise<void>>();
let allPending: Promise<void> | null = null;

export function gatewayServiceForUrl(url: string): Service | null {
  const parsed = new URL(url, window.location.origin);
  const gateway = new URL(GATEWAY_URL || '/', window.location.origin);
  if (parsed.origin !== gateway.origin) return null;
  const match = parsed.pathname.match(/^\/api\/(auth|dashboard|project|profile)(?:\/|$)/);
  return match ? (match[1] as Service) : null;
}

async function fetchWake(service?: Service): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STARTUP_TIMEOUT_MS);
  const url = `${GATEWAY_URL}/api/wake${service ? `?service=${service}` : ''}`;

  try {
    while (!controller.signal.aborted) {
      let response: Response | undefined;
      try {
        response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      } catch {
        // A sleeping gateway can itself return a network error while starting.
        if (controller.signal.aborted) break;
      }

      if (response) {
        const data = await response.json().catch(() => null);
        if (data?.code === 'SERVICE_UNAVAILABLE') {
          throw new Error(data.error || 'Backend service is unavailable. Please try again.');
        }
        if (response.ok && Array.isArray(data?.services)) {
          const results = (data as WakeResponse).services;
          for (const result of results) {
            if (SERVICES.includes(result.service) && result.status === 'awake') {
              readyAt.set(result.service, Date.now());
            }
          }
          if (
            service &&
            !results.some((result) => result.service === service && result.status === 'awake')
          ) {
            throw new Error('Backend service is unavailable. Please try again.');
          }
          return;
        }
        if (![502, 503, 504].includes(response.status)) {
          throw new Error('Unable to start backend services. Please try again.');
        }
      }

      // Retry only this safe wake-up GET, never replay a user's write/upload.
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Backend services took too long to start. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}

export function ensureBackendReady(url: string): Promise<void> {
  const service = gatewayServiceForUrl(url);
  if (!service) return Promise.resolve();
  const existing = pending.get(service);
  if (existing) return existing;
  const timestamp = readyAt.get(service);
  if (timestamp && Date.now() - timestamp < READY_TTL_MS) return Promise.resolve();
  const promise = fetchWake(service).finally(() => pending.delete(service));
  pending.set(service, promise);
  return promise;
}

export function invalidateBackendReady(url: string): void {
  const service = gatewayServiceForUrl(url);
  if (service) readyAt.delete(service);
}

// For callers that need the raw Response (templates, attachments and search).
export async function fetchFromGateway(url: string, options?: RequestInit): Promise<Response> {
  await ensureBackendReady(url);
  const response = await fetch(url, options);
  if ([502, 503, 504].includes(response.status)) invalidateBackendReady(url);
  return response;
}

export function wakeBackendServices(): Promise<void> {
  if (allPending) return allPending;
  if (SERVICES.every((service) => Date.now() - (readyAt.get(service) || 0) < READY_TTL_MS)) {
    return Promise.resolve();
  }
  allPending = fetchWake().finally(() => {
    allPending = null;
  });
  return allPending;
}

export function startBackendWake(): void {
  void wakeBackendServices().catch((error) => {
    console.warn('[gateway] Backend wake-up failed:', error);
  });
}
