import { request, PROJECT_URL } from "@/lib/api";

export async function addEntry(user_email, project_name, entry_object, due_date) {
  return request(`${PROJECT_URL}/service/entry`, {
    method: "POST",
    body: JSON.stringify({
      function: "add",
      values: { user_email, project_name, entry_object, due_date },
    }),
  });
}

export async function updateEntry(user_email, project_name, old_entry, new_entry) {
  return request(`${PROJECT_URL}/service/entry`, {
    method: "POST",
    body: JSON.stringify({
      function: "update",
      values: { user_email, project_name, old_entry, new_entry },
    }),
  });
}

export async function getEntries(user_email, project_name) {
  return request(`${PROJECT_URL}/service/entry`, {
    method: "POST",
    body: JSON.stringify({
      function: "get",
      values: { user_email, project_name },
    }),
  });
}

export async function getAllEntries(user_email) {
  return request(`${PROJECT_URL}/service/entry`, {
    method: "POST",
    body: JSON.stringify({
      function: "getAll",
      values: { user_email },
    }),
  });
}

export async function deleteEntry(user_email, project_name, entry) {
  return request(`${PROJECT_URL}/service/entry`, {
    method: "POST",
    body: JSON.stringify({
      function: "delete",
      values: { user_email, project_name, entry },
    }),
  });
}

export async function sortEntries(user_email, project_name, sort_type) {
  return request(`${PROJECT_URL}/service/entry`, {
    method: "POST",
    body: JSON.stringify({
      function: "sort",
      values: { user_email, project_name, sort_type },
    }),
  });
}
