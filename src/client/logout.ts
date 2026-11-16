/** Ends the login on this device and goes to the login page (S-01). */
export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.replace("/login");
}
