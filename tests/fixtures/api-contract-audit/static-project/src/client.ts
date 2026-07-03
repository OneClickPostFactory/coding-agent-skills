export async function loadUsers() {
  return fetch("/api/users");
}
