// TODO: Implement archive functionality
// Placeholder functions for future archive feature

export async function archiveProject(_user_email, _project_name) {
  console.warn("archiveProject: not implemented yet");
  return { success: false, message: "Archive feature not yet implemented" };
}

export async function unarchiveProject(_user_email, _project_name) {
  console.warn("unarchiveProject: not implemented yet");
  return { success: false, message: "Archive feature not yet implemented" };
}

export async function archiveEntry(_user_email, _project_name, _entry_id) {
  console.warn("archiveEntry: not implemented yet");
  return { success: false, message: "Archive feature not yet implemented" };
}

export async function unarchiveEntry(_user_email, _project_name, _entry_id) {
  console.warn("unarchiveEntry: not implemented yet");
  return { success: false, message: "Archive feature not yet implemented" };
}

export async function getArchives(_user_email, _project_name) {
  console.warn("getArchives: not implemented yet");
  return { success: false, data: [], message: "Archive feature not yet implemented" };
}

export async function getUnarchived(_user_email, _project_name) {
  console.warn("getUnarchived: not implemented yet");
  return { success: false, data: [], message: "Archive feature not yet implemented" };
}

export async function getArchivedProjects(user_email) {
  const res = await fetch(url + '/service/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'getArchivedProjects', values: { user_email } })
  });
  return res.json();
}

export async function getUnarchivedProjects(user_email) {
  const res = await fetch(url + '/service/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'getUnarchivedProjects', values: { user_email } })
  });
  return res.json();
}
