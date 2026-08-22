import { request, PROJECT_URL } from "@/lib/api";

export async function addEntry(
  user_email,
  project_name,
  entry_object,
  due_date,
  priority,
  status,
  started_at,
  ended_at,
  duration
) {
  return request(`${PROJECT_URL}/service/entry`, {
    method: "POST",
    body: JSON.stringify({
      function: "add",
      values: {
        user_email,
        project_name,
        entry_object,
        due_date,
        priority,
        status,
        started_at,
        ended_at,
        duration,
      },
    }),
  });
}

export async function updateEntry(
  user_email,
  project_name,
  entry_id,
  new_entry,
  due_date,
  priority,
  status,
  started_at,
  ended_at,
  duration
) {
  return request(`${PROJECT_URL}/service/entry`, {
    method: "POST",
    body: JSON.stringify({
      function: "update",
      values: {
        user_email,
        project_name,
        entry_id,
        new_entry,
        due_date,
        priority,
        status,
        started_at,
        ended_at,
        duration,
      },
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

export async function deleteEntryById(user_email, entry_id) {
  return request(`${PROJECT_URL}/service/entry`, {
    method: "POST",
    body: JSON.stringify({
      function: "deleteById",
      values: { user_email, entry_id },
    }),
  });
}

export async function sortUnarchivedEntries(user_email, project_name, sort_type) {
  return request(`${PROJECT_URL}/service/entry`, {
    method: "POST",
    body: JSON.stringify({
      function: "sortUnarchived",
      values: { user_email, project_name, sort_type },
    }),
  });
}

export async function sortArchivedEntries(user_email, project_name, sort_type) {
  return request(`${PROJECT_URL}/service/entry`, {
    method: "POST",
    body: JSON.stringify({
      function: "sortArchived",
      values: { user_email, project_name, sort_type },
    }),
  });
}
