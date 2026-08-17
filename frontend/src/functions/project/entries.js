const url = "https://project-service-96ml.onrender.com";

export async function addEntry(user_email, project_name, entry_object, due_date, priority, status) {
  const res = await fetch(url + '/service/entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'add', values: { user_email, project_name, entry_object, due_date, priority, status } })
  });
  return res.json();
}

export async function updateEntry(user_email, project_name, entry_id, new_entry, due_date, priority, status) {
  const res = await fetch(url + '/service/entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'update', values: { user_email, project_name, entry_id, new_entry, due_date, priority, status } })
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

export async function getAllEntries(user_email) {
  const res = await fetch(url + '/service/entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'getAll', values: { user_email } })
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

export async function sortUnarchivedEntries(user_email, project_name, sort_type) {
  const res = await fetch(url + '/service/entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'sortUnarchived', values: { user_email, project_name, sort_type } })
  });
  return res.json();
}

export async function sortArchivedEntries(user_email, project_name, sort_type) {
  const res = await fetch(url + '/service/entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'sortArchived', values: { user_email, project_name, sort_type } })
  });
  return res.json();
}