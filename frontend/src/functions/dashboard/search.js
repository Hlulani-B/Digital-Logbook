
const url = "https://dashboard-service-bpc5.onrender.com";
 
export async function searchAll(user_email, keyword) {
  const res = await fetch(url + '/service/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'searchAll', values: { user_email, keyword } })
  });
  return res.json();
}
 
export async function searchProject(user_email, project_name, keyword) {
  const res = await fetch(url + '/service/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'searchProject', values: { user_email, project_name, keyword } })
  });
  return res.json();
}
 
export async function searchProjects(user_email, keyword) {
  const res = await fetch(url + '/service/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'searchProjects', values: { user_email, keyword } })
  });
  return res.json();
}
 