import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const serviceNames = ['auth', 'dashboard', 'project', 'profile'];

async function backend(t, handler) {
  const server = http.createServer(handler).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function gateway(t, targets, settings = {}) {
  const placeholder = http.createServer().listen(0, '127.0.0.1');
  await once(placeholder, 'listening');
  const port = placeholder.address().port;
  await new Promise((resolve) => placeholder.close(resolve));
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      WAKE_TIMEOUT_MS: '2500',
      WAKE_PROBE_TIMEOUT_MS: '200',
      WAKE_RETRY_INTERVAL_MS: '20',
      WAKE_TTL_MS: '60000',
      ...Object.fromEntries(
        serviceNames.map((name) => [`${name.toUpperCase()}_SERVICE_URL`, targets[name]])
      ),
      ...settings,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let diagnostics = '';
  child.stderr.on('data', (chunk) => (diagnostics += chunk));
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(base)).ok) return base;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Gateway did not start: ${diagnostics}`);
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
}

test('login wakes all backends concurrently and shares probes across requests', async (t) => {
  const health = new Map();
  const counts = Object.fromEntries(serviceNames.map((name) => [name, 0]));
  let release;
  const allStarted = new Promise((resolve) => (release = resolve));
  const targets = Object.fromEntries(
    await Promise.all(
      serviceNames.map(async (name) => [
        name,
        await backend(t, async (req, res) => {
          if (req.url === '/') {
            counts[name]++;
            health.set(name, res);
            if (health.size === 4) release();
            return;
          }
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          json(res, 200, { service: name, body: Buffer.concat(chunks).toString() });
        }),
      ])
    )
  );
  const base = await gateway(t, targets, { WAKE_PROBE_TIMEOUT_MS: '2000' });
  const warm = fetch(`${base}/api/wake`, { signal: AbortSignal.timeout(4000) });
  const first = fetch(`${base}/api/profile/service/login`, {
    method: 'POST',
    body: 'login body',
    signal: AbortSignal.timeout(4000),
  });
  const second = fetch(`${base}/api/profile/service/login`, {
    method: 'POST',
    body: 'second login body',
    signal: AbortSignal.timeout(4000),
  });
  await Promise.race([
    allStarted,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Probes were not concurrent')), 1500)
    ),
  ]);
  // Profile requests complete even while every unrelated service is still booting.
  json(health.get('profile'), 200, { status: 'healthy' });
  assert.deepEqual(await (await first).json(), { service: 'profile', body: 'login body' });
  assert.deepEqual(await (await second).json(), { service: 'profile', body: 'second login body' });
  for (const name of serviceNames.filter((name) => name !== 'profile')) {
    json(health.get(name), 200, { status: 'healthy' });
  }
  assert.equal((await (await warm).json()).success, true);
  assert.deepEqual(counts, { auth: 1, dashboard: 1, project: 1, profile: 1 });
});

test('cold-start HTTP errors and connection resets are retried before forwarding a write', async (t) => {
  let probes = 0;
  let writes = 0;
  const target = await backend(t, async (req, res) => {
    if (req.url === '/') {
      probes++;
      if (probes === 1) return req.socket.destroy();
      if (probes === 2) return json(res, 502, { error: 'starting' });
      if (probes === 3) return json(res, 503, { error: 'starting' });
      return json(res, 200, { status: 'healthy' });
    }
    writes++;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    json(res, 200, { body: Buffer.concat(chunks).toString() });
  });
  const healthy = await backend(t, (req, res) => json(res, 200, { status: 'healthy' }));
  const base = await gateway(t, {
    auth: healthy,
    dashboard: healthy,
    project: target,
    profile: healthy,
  });
  const response = await fetch(`${base}/api/project/service/entries`, {
    method: 'POST',
    body: 'new entry',
    signal: AbortSignal.timeout(4000),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { body: 'new entry' });
  assert.equal(writes, 1);
  assert.ok(probes >= 4);
});

test('an unavailable backend cannot block a healthy login or receive a user write', async (t) => {
  let writes = 0;
  const healthy = await backend(t, (req, res) => json(res, 200, { status: 'healthy' }));
  const sleeping = await backend(t, (req, res) => {
    if (req.url !== '/') writes++;
    json(res, 502, { error: 'starting' });
  });
  const base = await gateway(
    t,
    { auth: healthy, profile: healthy, dashboard: sleeping, project: sleeping },
    { WAKE_TIMEOUT_MS: '200' }
  );
  const login = await fetch(`${base}/api/profile/service/login`, { method: 'POST', body: '{}' });
  assert.equal(login.status, 200);
  const unavailable = await fetch(`${base}/api/project/service/entries`, {
    method: 'POST',
    body: 'must not be forwarded',
  });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get('retry-after'), '5');
  assert.equal((await unavailable.json()).code, 'SERVICE_UNAVAILABLE');
  assert.equal(writes, 0);
  const wake = await fetch(`${base}/api/wake`);
  assert.equal(wake.status, 207);
  const body = await wake.json();
  assert.equal(body.success, false);
  assert.equal(body.services.find((result) => result.service === 'project').status, 'failed');
});

test('a restarted destination is rechecked even when its previous readiness is cached', async (t) => {
  let restarting = false;
  let writes = 0;
  const target = await backend(t, (req, res) => {
    if (req.url === '/') {
      if (restarting) {
        restarting = false;
        return json(res, 502, { error: 'restarting' });
      }
      return json(res, 200, { status: 'healthy' });
    }
    writes++;
    json(res, 200, { success: true });
  });
  const base = await gateway(t, Object.fromEntries(serviceNames.map((name) => [name, target])));
  assert.equal((await fetch(`${base}/api/wake`)).status, 200);
  restarting = true;
  assert.equal(
    (await fetch(`${base}/api/profile/service/login`, { method: 'POST', body: '{}' })).status,
    200
  );
  assert.equal(writes, 1);
  const cached = await (await fetch(`${base}/api/wake`)).json();
  assert.equal(cached.services.length, 4);
  assert.equal(cached.success, true);
});

test('targeted wake reports only its destination and rejects unknown services', async (t) => {
  const target = await backend(t, (req, res) => json(res, 200, { status: 'healthy' }));
  const base = await gateway(t, Object.fromEntries(serviceNames.map((name) => [name, target])));
  const wake = await fetch(`${base}/api/wake?service=profile`);
  assert.equal(wake.headers.get('cache-control'), 'no-store');
  const body = await wake.json();
  assert.equal(body.success, true);
  assert.deepEqual(
    body.services.map((result) => result.service),
    ['profile']
  );
  assert.equal((await fetch(`${base}/api/wake?service=unknown`)).status, 400);
  assert.equal((await fetch(`${base}/api/wake?service=profile&service=profile`)).status, 400);
});

test('health probes have a bounded timeout even when a backend never responds', async (t) => {
  let probes = 0;
  const target = await backend(t, () => probes++);
  const base = await gateway(t, Object.fromEntries(serviceNames.map((name) => [name, target])), {
    WAKE_TIMEOUT_MS: '200',
    WAKE_PROBE_TIMEOUT_MS: '40',
  });
  const response = await fetch(`${base}/api/wake?service=profile`, {
    signal: AbortSignal.timeout(2000),
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).service, 'profile');
  assert.ok(probes >= 8, 'each backend received multiple health probes');
});

test('a proxy connection failure returns a structured outage without replaying a write', async (t) => {
  let writes = 0;
  const target = await backend(t, (req, res) => {
    if (req.url === '/') return json(res, 200, { status: 'healthy' });
    writes++;
    req.socket.destroy();
  });
  const base = await gateway(t, Object.fromEntries(serviceNames.map((name) => [name, target])));
  const response = await fetch(`${base}/api/project/service/entries`, {
    method: 'POST',
    body: '{}',
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'SERVICE_UNAVAILABLE');
  assert.equal(writes, 1);
});

test('event streams are forwarded as they arrive after readiness', async (t) => {
  const target = await backend(t, (req, res) => {
    if (req.url === '/') return json(res, 200, { status: 'healthy' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.write('event: connected\ndata: {"ready":true}\n\n');
  });
  const base = await gateway(t, Object.fromEntries(serviceNames.map((name) => [name, target])));
  const controller = new AbortController();
  t.after(() => controller.abort());
  const response = await fetch(`${base}/api/project/service/nl-stream`, {
    signal: controller.signal,
  });
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  const { value } = await response.body.getReader().read();
  assert.match(new TextDecoder().decode(value), /event: connected/);
});
