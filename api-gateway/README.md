# API gateway

The frontend sends backend requests through `/api/auth`, `/api/dashboard`,
`/api/project`, and `/api/profile`. Configure their destinations in `.env` using
`.env.example`, then run `npm start`. Run the gateway tests with `npm test`.

Every backend interaction starts health checks for all four services concurrently.
The gateway waits only for the requested destination before forwarding the original
request, including its body and authorization. Concurrent requests share a service's
pending health check. Only successful HTTP health responses count as ready; health
checks retry connection failures and unsuccessful HTTP responses until the startup
deadline. The destination is checked again on each interaction, so a restarted
service can recover even when it was recently ready.

`GET /api/wake` starts all services and returns their results (HTTP 200 when all
are ready, 207 for partial availability). `GET /api/wake?service=profile` also
starts all services, but responds as soon as profile is ready. An unavailable
destination returns HTTP 503 with `code: "SERVICE_UNAVAILABLE"` and `Retry-After: 5`.
`/` and `/health` check the gateway itself without waking backends.

The frontend begins wake-up when the sign-in page or session loads and when a user
signs in. Before an API operation, it allows up to 180 seconds for gateway/backend
startup, independently of the operation's own timeout. Only wake-up GET requests
are retried; user writes and uploads are never automatically replayed. Readiness
is cached briefly in the browser and expires after inactivity.

| Environment variable     | Default  | Purpose                                         |
| ------------------------ | -------- | ----------------------------------------------- |
| `WAKE_TIMEOUT_MS`        | `115000` | Total startup budget for each backend           |
| `WAKE_PROBE_TIMEOUT_MS`  | `10000`  | Maximum duration of one health attempt          |
| `WAKE_RETRY_INTERVAL_MS` | `1000`   | Delay between health attempts                   |
| `WAKE_TTL_MS`            | `60000`  | Readiness cache for background sibling checks   |
| `PROXY_TIMEOUT_MS`       | `120000` | Timeout when forwarding a ready backend request |

Deploy both `api-gateway` and `frontend` to enable this behavior in production.
Keep the frontend's `VITE_API_GATEWAY_URL` pointed at the gateway and the gateway's
four `*_SERVICE_URL` values pointed at the backend service origins. These changes
require no backend service code changes.
