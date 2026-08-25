import { request, PROJECT_URL } from '@/lib/api';

export async function setPriority(user_email, priorityValue, project_name, entry_id) {
  return request(`${PROJECT_URL}/service/priority`, {
    method: 'POST',
    body: JSON.stringify({
      function: 'set',
      values: { user_email, priorityValue, project_name, entry_id },
    }),
  });
}
