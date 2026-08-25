import { request, PROJECT_URL } from '@/lib/api';

export async function addProject(user_email, project_name, description) {
  return request(`${PROJECT_URL}/service/project`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'add',
      values: { user_email, project_name, description },
    }),
  });
}

export async function editProjectName(user_email, new_project_name, old_project_name) {
  return request(`${PROJECT_URL}/service/project`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'edit',
      values: { user_email, new_project_name, old_project_name },
    }),
  });
}

export async function deleteProject(user_email, project_name) {
  return request(`${PROJECT_URL}/service/project`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'delete',
      values: { user_email, project_name },
    }),
  });
}

export async function getProjectsByEmail(user_email) {
  return request(`${PROJECT_URL}/service/project`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'getProjects',
      values: { user_email },
    }),
  });
}
