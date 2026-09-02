import { request, PROJECT_URL } from '@/lib/api';

export async function archiveProject(user_email, project_name) {
  return request(`${PROJECT_URL}/service/archive`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'archive_project',
      values: { user_email, project_name },
    }),
  });
}

export async function unarchiveProject(user_email, project_name) {
  return request(`${PROJECT_URL}/service/archive`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'unarchive_project',
      values: { user_email, project_name },
    }),
  });
}

export async function archiveEntry(user_email, project_name, entry_id) {
  return request(`${PROJECT_URL}/service/archive`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'archive_entry',
      values: { user_email, project_name, entry_id },
    }),
  });
}

export async function unarchiveEntry(user_email, project_name, entry_id) {
  return request(`${PROJECT_URL}/service/archive`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'unarchive_entry',
      values: { user_email, project_name, entry_id },
    }),
  });
}

export async function getArchives(user_email, project_name) {
  return request(`${PROJECT_URL}/service/archive`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'getArchives',
      values: { user_email, project_name: project_name || null },
    }),
  });
}

export async function getUnarchived(user_email, project_name) {
  return request(`${PROJECT_URL}/service/archive`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'getUnarchived',
      values: { user_email, project_name: project_name || null },
    }),
  });
}

export async function getArchivedProjects(user_email) {
  return request(`${PROJECT_URL}/service/archive`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'getArchivedProjects',
      values: { user_email },
    }),
  });
}

export async function getUnarchivedProjects(user_email) {
  return request(`${PROJECT_URL}/service/archive`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'getUnarchivedProjects',
      values: { user_email },
    }),
  });
}
