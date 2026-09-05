/**
 * Profile API client — talks to /api/profile/*.
 *
 * Lets pages look up another user's display name / role without importing
 * `firebase/firestore` directly. Pair with the server endpoint in
 * server/routes/profile.js.
 */

import type { Profile } from "../types/firestore";
import { authFetch } from "../lib/authFetch";

export async function getProfile(userId: string): Promise<Profile | null> {
  const res = await fetch(`/api/profile/${encodeURIComponent(userId)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  const data = (await res.json()) as { profile: Profile };
  return data.profile;
}

export async function saveProfilePhoto(photoDataUrl: string | null): Promise<Profile> {
  const data = await authFetch<{ profile: Profile }>("/api/profile/photo", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoDataUrl }),
  });
  return data.profile;
}
