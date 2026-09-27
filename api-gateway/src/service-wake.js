import { setTimeout as delay } from 'node:timers/promises';

// Only health requests are retried. User requests (including writes/uploads)
// remain untouched until their destination is ready.
export function createServiceWake(
  services,
  { timeoutMs = 115000, probeTimeoutMs = 10000, retryIntervalMs = 1000, ttlMs = 60000 } = {}
) {
  const states = new Map();

  async function probe(service, target) {
    const startedAt = Date.now();
    const deadline = startedAt + timeoutMs;
    let httpStatus;
    let error;

    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${target}/`, {
          signal: AbortSignal.timeout(Math.min(probeTimeoutMs, deadline - Date.now())),
          headers: { 'User-Agent': 'digital-logbook-api-gateway' },
          cache: 'no-store',
          redirect: 'error',
        });
        httpStatus = response.status;
        await response.body?.cancel();
        if (response.ok) {
          return {
            service,
            status: 'awake',
            httpStatus,
            responseTimeMs: Date.now() - startedAt,
          };
        }
        error = `Health check returned HTTP ${httpStatus}`;
      } catch (err) {
        error = err.message;
      }

      const remaining = deadline - Date.now();
      if (remaining > 0) await delay(Math.min(retryIntervalMs, remaining));
    }

    console.warn(`[gateway] ${service} did not become ready: ${error}`);
    return {
      service,
      status: 'failed',
      httpStatus,
      error,
      responseTimeMs: Date.now() - startedAt,
    };
  }

  function wake(service, force = false) {
    let state = states.get(service);
    if (!state) {
      state = { readyAt: 0, result: null, pending: null };
      states.set(service, state);
    }
    if (state.pending) return state.pending;
    if (!force && state.readyAt && Date.now() - state.readyAt < ttlMs) {
      return Promise.resolve(state.result);
    }

    state.pending = probe(service, services[service])
      .then((result) => {
        state.result = result;
        state.readyAt = result.status === 'awake' ? Date.now() : 0;
        return result;
      })
      .finally(() => {
        state.pending = null;
      });
    return state.pending;
  }

  function wakeAll(requestedService) {
    // Start every probe before the caller awaits any individual service.
    return Object.fromEntries(
      Object.keys(services).map((service) => [service, wake(service, service === requestedService)])
    );
  }

  function invalidate(service) {
    const state = states.get(service);
    if (state) state.readyAt = 0;
  }

  return { wakeAll, invalidate };
}
