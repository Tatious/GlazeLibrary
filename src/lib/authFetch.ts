/**
 * Shared helper for hitting authenticated server endpoints from the client.
 *
 * Pulls the current Firebase ID token off `auth.currentUser` and attaches it
 * as `Authorization: Bearer <token>`. Callers never have to think about auth
 * headers or token refresh.
 *
 * - `authFetch(url, init)` — JSON in, JSON out.
 * - `authFetchForm(url, formData, method?)` — for multipart uploads.
 *
 * Both throw on a non-2xx response with the server's `error` field if present.
 * Both throw "Not signed in" if there's no current user — callers should gate
 * with `useAuth()` / `useRequireAuth()` and not call these without a user.
 */

import { auth } from "./firebase";

async function bearerHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export async function authFetch<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = await bearerHeader();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  // DELETEs (and some PUTs) can return empty bodies.
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export async function authFetchForm<T>(
  url: string,
  formData: FormData,
  method: "POST" | "PUT" = "POST",
): Promise<T> {
  const headers = await bearerHeader();
  const res = await fetch(url, { method, headers, body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
