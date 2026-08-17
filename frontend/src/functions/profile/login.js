const url = "https://profile-service-0zk7.onrender.com";

export async function checkUser(email) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout for cold starts
  try {
    const res = await fetch(url + '/service/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ function: 'checkUser', values: { email } }),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`checkUser returned ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}
