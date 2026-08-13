const url = "";

export async function addEntry(user_email, project_name, entry_object, due_date) {
  const res = await fetch(url + '/service/entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'add', values: { user_email, project_name, entry_object, due_date } })
  });
  return res.json();
}

export async function updateEntry(user_email, project_name, old_entry, new_entry) {
  const res = await fetch(url + '/service/entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'update', values: { user_email, project_name, old_entry, new_entry } })
  });
  return res.json();
}

export async function getEntries(user_email, project_name) {
  const res = await fetch(url + '/service/entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'get', values: { user_email, project_name } })
  });
  return res.json();
}

export async function deleteEntry(user_email, project_name, entry) {
  const res = await fetch(url + '/service/entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'delete', values: { user_email, project_name, entry } })
  });
  return res.json();
}

export async function sortEntries(user_email, project_name, sort_type) {
  const res = await fetch(url + '/service/entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'sort', values: { user_email, project_name, sort_type } })
  });
  return res.json();
}