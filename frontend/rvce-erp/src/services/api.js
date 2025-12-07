const BASE_URL = "http://127.0.0.1:8000";

export async function fetchTimetable() {
  const res = await fetch(`${BASE_URL}/timetable`);
  return await res.json();
}

export async function generateTimetable() {
  await fetch(`${BASE_URL}/generate`, { method: "POST" });
  return fetchTimetable();
}