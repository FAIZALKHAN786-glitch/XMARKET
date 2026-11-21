/** Minimal typed fetch client. Cookies (session) flow automatically same-origin. */

export async function api<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: boolean; data?: T; error?: { code: string; message: string } }> {
  const res = await fetch(input, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: body?.error ?? { code: "unknown", message: "Request failed" } };
  }
  return { ok: true, data: body?.data };
}
