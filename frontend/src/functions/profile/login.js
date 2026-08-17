import { request, PROFILE_URL } from "@/lib/api";

export async function checkUser(email) {
  return request(`${PROFILE_URL}/service/login`, {
    method: "POST",
    body: JSON.stringify({ function: "checkUser", values: { email } }),
  });
}
