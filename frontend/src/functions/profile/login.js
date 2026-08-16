const url = "https://profile-service-0zk7.onrender.com";

export async function checkUser(email) {
  const res = await fetch(url + '/service/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'checkUser', values: { email } })
  });
  return res.json();
}
