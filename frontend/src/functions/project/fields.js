const url = "https://project-service-96ml.onrender.com";

export async function addField(user_email, table_name, field_name, data_type, is_required) {
  const res = await fetch(url + '/service/field', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'add', values: { user_email, table_name, field_name, data_type, is_required } })
  });
  return res.json();
}

export async function editField(user_email, table_name, field_name, data_type, is_required) {
  const res = await fetch(url + '/service/field', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'edit', values: { user_email, table_name, field_name, data_type, is_required } })
  });
  return res.json();
}

export async function getFields(user_email, table_name) {
  const res = await fetch(url + '/service/field', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'get', values: { user_email, table_name } })
  });
  return res.json();
}
