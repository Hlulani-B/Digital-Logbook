const url = "https://profile-service-0zk7.onrender.com";

export async function updateUsername(email, username) {
  const res = await fetch(url + '/service/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'username', values: { email, username } })
  });
  return res.json();
}

export async function addEmail(email) {
  const res = await fetch(url + '/service/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'email', values: { email } })
  });
  return res.json();
}

export async function updateName(email, new_name) {
  const res = await fetch(url + '/service/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'name', values: { email, new_name } })
  });
  return res.json();
}

export async function updateAvatar(email, avatarUrl) {
  const res = await fetch(url + '/service/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'avatar', values: { email, url: avatarUrl } })
  });
  return res.json();
}

export async function getProfile(email) {
  const res = await fetch(url + '/service/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'getProfile', values: { email } })
  });
  return res.json();
}

export async function deleteProfile(email) {
  const res = await fetch(url + '/service/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'deleteProfile', values: { email } })
  });
  return res.json();
}
