const url = "https://project-service-96ml.onrender.com";

export async function setPriority(user_email, priorityValue, project_name, entry_id) {
  const res = await fetch(url + '/service/priority', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'set', values: { user_email, priorityValue, project_name, entry_id } })
  });
  return res.json();
}
