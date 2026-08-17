import { request, PROFILE_URL } from "@/lib/api";

export async function updateUsername(email, username) {
  return request(`${PROFILE_URL}/service/profile`, {
    method: "POST",
    body: JSON.stringify({ function: "username", values: { email, username } }),
  });
}

export async function addEmail(email) {
  return request(`${PROFILE_URL}/service/profile`, {
    method: "POST",
    body: JSON.stringify({ function: "email", values: { email } }),
  });
}

export async function updateName(email, new_name) {
  return request(`${PROFILE_URL}/service/profile`, {
    method: "POST",
    body: JSON.stringify({ function: "name", values: { email, new_name } }),
  });
}

export async function updateAvatar(email, avatarUrl) {
  return request(`${PROFILE_URL}/service/profile`, {
    method: "POST",
    body: JSON.stringify({ function: "avatar", values: { email, url: avatarUrl } }),
  });
}

export async function getProfile(email) {
  return request(`${PROFILE_URL}/service/profile`, {
    method: "POST",
    body: JSON.stringify({ function: "getProfile", values: { email } }),
  });
}

export async function deleteProfile(email) {
  return request(`${PROFILE_URL}/service/profile`, {
    method: "POST",
    body: JSON.stringify({ function: "deleteProfile", values: { email } }),
  });
}
