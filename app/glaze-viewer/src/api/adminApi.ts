/**
 * Admin API client — talks to /api/admin/* (Firebase-authenticated, admin only).
 *
 * All calls use the shared `authFetch` helper, which attaches the current
 * Firebase ID token as `Bearer`. Callers don't have to think about headers.
 */

import type { InviteCode, Profile } from "../types/firestore";
import { authFetch } from "../lib/authFetch";

// =============================================================================
// Invite codes
// =============================================================================

export function listInviteCodes(): Promise<InviteCode[]> {
  return authFetch<InviteCode[]>("/api/admin/invite-codes");
}

export function createInviteCode(code: string): Promise<InviteCode> {
  return authFetch<InviteCode>("/api/admin/invite-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

export function revokeInviteCode(codeId: string): Promise<void> {
  return authFetch<void>(`/api/admin/invite-codes/${codeId}`, {
    method: "DELETE",
  });
}

// =============================================================================
// Users
// =============================================================================

export function listUsers(): Promise<Profile[]> {
  return authFetch<Profile[]>("/api/admin/users");
}

export function updateUserRole(
  userId: string,
  newRole: "admin" | "user",
): Promise<{ success: true; userId: string; newRole: string }> {
  return authFetch("/api/admin/update-role", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, newRole }),
  });
}

export function deleteUser(userId: string): Promise<void> {
  return authFetch<void>(`/api/admin/delete-user/${userId}`, {
    method: "DELETE",
  });
}
