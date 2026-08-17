import { request, PROJECT_URL } from "@/lib/api";

export async function addField(user_email, table_name, field_name, data_type, is_required) {
  return request(`${PROJECT_URL}/service/field`, {
    method: "POST",
    body: JSON.stringify({
      function: "add",
      values: { user_email, table_name, field_name, data_type, is_required },
    }),
  });
}

export async function editField(user_email, table_name, field_name, data_type, is_required) {
  return request(`${PROJECT_URL}/service/field`, {
    method: "POST",
    body: JSON.stringify({
      function: "edit",
      values: { user_email, table_name, field_name, data_type, is_required },
    }),
  });
}

export async function getFields(user_email, table_name) {
  return request(`${PROJECT_URL}/service/field`, {
    method: "POST",
    body: JSON.stringify({
      function: "get",
      values: { user_email, table_name },
    }),
  });
}
