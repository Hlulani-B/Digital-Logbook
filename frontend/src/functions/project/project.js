const url = "https://project-service-96ml.onrender.com";

export async function addProject(user_email, project_name) {
  const res = await fetch(url + '/service/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'add', values: { user_email, project_name } })
  });
  return res.json();
}

export async function editProjectName(user_email, new_project_name, old_project_name) {
  const res = await fetch(url + '/service/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'edit', values: { user_email, new_project_name, old_project_name } })
  });
  return res.json();
}

export async function deleteProject(user_email, project_name) {
  const res = await fetch(url + '/service/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'delete', values: { user_email, project_name } })
  });
  return res.json();
}