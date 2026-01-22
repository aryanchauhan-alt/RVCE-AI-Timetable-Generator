const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://rvce-ai-timetable-generator.onrender.com";

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login?username=${username}&password=${password}`, {
    method: "POST"
  });

  if (!res.ok) throw new Error("Invalid credentials");

  const data = await res.json();
  localStorage.setItem("token", data.token);
  localStorage.setItem("role", data.role);
  localStorage.setItem("external_id", data.external_id ?? "");
  return data;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("external_id");
}

export function getUser() {
  return {
    token: localStorage.getItem("token"),
    role: localStorage.getItem("role"),
    external_id: localStorage.getItem("external_id")
  };
}