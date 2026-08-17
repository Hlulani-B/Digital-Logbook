const url = "https://project-service-96ml.onrender.com";

export async function archiveProject(user_email, project_name) {
  const res = await fetch(url + '/service/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'archive_project', values: { user_email, project_name } })
  });
  return res.json();
}

export async function unarchiveProject(user_email, project_name) {
  const res = await fetch(url + '/service/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'unarchive_project', values: { user_email, project_name } })
  });
  return res.json();
}

export async function archiveEntry(user_email, project_name, entry) {
  const res = await fetch(url + '/service/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'archive_entry', values: { user_email, project_name, entry } })
  });
  return res.json();
}

export async function unarchiveEntry(user_email, project_name, entry) {
  const res = await fetch(url + '/service/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'unarchive_entry', values: { user_email, project_name, entry } })
  });
  return res.json();
}

export async function getArchives(user_email, project_name) {
  const res = await fetch(url + '/service/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'getArchives', values: { user_email, project_name } })
  });
  return res.json();
}

export async function getUnarchived(user_email, project_name) {
  const res = await fetch(url + '/service/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'getUnarchived', values: { user_email, project_name } })
  });
  return res.json();
}
