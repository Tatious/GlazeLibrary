/**
 * Admin Page
 * Admin-only features: generate invite codes, manage users
 */

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  createInviteCode as createInviteCodeApi,
  deleteUser as deleteUserApi,
  listInviteCodes,
  listUsers,
  revokeInviteCode as revokeInviteCodeApi,
  updateUserRole,
} from "../api/adminApi";
import { PageLayout } from "../components/PageLayout";
import { Alert } from "../components/Alert";
import type { InviteCode, Profile } from "../types/firestore";

export function AdminPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [confirmRevokeCodeId, setConfirmRevokeCodeId] = useState<string | null>(null);
  const [isRevokingCode, setIsRevokingCode] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/glazes", { replace: true });
    }
  }, [authLoading, isAdmin, navigate]);

  // Fetch data
  useEffect(() => {
    if (!isAdmin) return;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch invite codes via server endpoint (requires admin auth)
        const codes = await listInviteCodes();
        setInviteCodes(codes);

        // Fetch all profiles via server endpoint (also admin-gated; the page
        // used to read Firestore directly which bypassed the API layer).
        const profiles = await listUsers();
        setUsers(profiles);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [isAdmin]);

  // Generate new invite code
  const generateInviteCode = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Generate a random code (8 characters, alphanumeric)
      const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();

      const newCode = await createInviteCodeApi(code);
      setInviteCodes((prev) => [newCode, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate code");
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy invite link to clipboard
  const copyInviteLink = (code: string) => {
    const url = `${window.location.origin}/signup?code=${code}`;
    navigator.clipboard.writeText(url);
  };

  // Toggle admin status
  const toggleAdmin = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    try {
      await updateUserRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  // Delete a user account
  const deleteUser = async (userId: string) => {
    setIsDeletingUser(true);
    setError(null);
    try {
      await deleteUserApi(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setConfirmDeleteUserId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Revoke an invite code
  const revokeInviteCode = async (codeId: string) => {
    setIsRevokingCode(true);
    setError(null);
    try {
      await revokeInviteCodeApi(codeId);
      setInviteCodes((prev) => prev.filter((c) => c.id !== codeId));
      setConfirmRevokeCodeId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke code");
    } finally {
      setIsRevokingCode(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <PageLayout maxWidth="4xl" padY="8">
        <div className="text-center text-clay-600 dark:text-clay-400">
          Loading...
        </div>
      </PageLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <PageLayout maxWidth="4xl" padY="8">
      <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-200 mb-8">
        Admin Dashboard
      </h1>

      {error && (
        <Alert className="mb-6">{error}</Alert>
      )}

      {/* Invite Codes Section */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-clay-700 dark:text-clay-300">
            Invite Codes
          </h2>
          <button
            onClick={generateInviteCode}
            disabled={isGenerating}
            className="px-4 py-2 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
          >
            {isGenerating ? "Generating..." : "Generate New Code"}
          </button>
        </div>

        <div className="bg-white dark:bg-earth-800 rounded-xl border-2 border-clay-200 dark:border-earth-600 overflow-hidden">
          <div className="divide-y divide-clay-200 dark:divide-earth-600">
            {inviteCodes.map((code) => (
              <div key={code.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-sm text-clay-800 dark:text-clay-200 truncate">
                      {code.code}
                    </span>
                    {code.used_by ? (
                      <span className="shrink-0 inline-block px-2 py-0.5 text-xs font-medium bg-clay-100 dark:bg-earth-700 text-clay-600 dark:text-clay-400 rounded">
                        Used
                      </span>
                    ) : (
                      <span className="shrink-0 inline-block px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                        Available
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-clay-500 dark:text-clay-400">
                    {new Date(code.created_at).toLocaleDateString()}
                  </span>
                </div>

                {!code.used_by && (
                  <div className="mt-2 flex items-center gap-3">
                    {confirmRevokeCodeId === code.id ? (
                      <>
                        <span className="text-xs text-clay-600 dark:text-clay-400">Revoke this code?</span>
                        <button
                          onClick={() => revokeInviteCode(code.id)}
                          disabled={isRevokingCode}
                          className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                        >
                          {isRevokingCode ? "Revoking…" : "Yes, Revoke"}
                        </button>
                        <button
                          onClick={() => setConfirmRevokeCodeId(null)}
                          className="text-sm text-clay-500 dark:text-clay-400 hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => copyInviteLink(code.code)}
                          className="text-sm text-terracotta-600 dark:text-terracotta-400 hover:underline"
                        >
                          Copy Link
                        </button>
                        <button
                          onClick={() => setConfirmRevokeCodeId(code.id)}
                          className="text-sm text-clay-500 dark:text-clay-400 hover:underline"
                          title="Revoke code"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            {inviteCodes.length === 0 && (
              <div className="px-4 py-8 text-center text-clay-500 dark:text-clay-500 text-sm">
                No invite codes yet. Generate one to invite users.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Users Section */}
      <section>
        <h2 className="text-lg font-semibold text-clay-700 dark:text-clay-300 mb-4">
          Users ({users.length})
        </h2>

        <div className="bg-white dark:bg-earth-800 rounded-xl border-2 border-clay-200 dark:border-earth-600 overflow-hidden">
          {/* Header row — hidden on mobile, shown on sm+ */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 bg-clay-50 dark:bg-earth-700 border-b border-clay-200 dark:border-earth-600">
            <span className="text-sm font-medium text-clay-600 dark:text-clay-400">User</span>
            <span className="text-sm font-medium text-clay-600 dark:text-clay-400">Role</span>
            <span className="text-sm font-medium text-clay-600 dark:text-clay-400">Joined</span>
            <span className="text-sm font-medium text-clay-600 dark:text-clay-400 text-right">Actions</span>
          </div>

          <div className="divide-y divide-clay-200 dark:divide-earth-600">
            {users.map((user) => (
              <div key={user.id} className="px-4 py-3">
                {/* Mobile layout: stacked */}
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/user/${user.id}`} className="min-w-0 hover:opacity-80">
                    <div className="text-sm font-medium text-clay-800 dark:text-clay-200 truncate">
                      {user.display_name || "Unnamed"}
                    </div>
                    <div className="text-xs text-clay-500 dark:text-clay-400 font-mono">
                      {user.id.slice(0, 8)}...
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                        user.role === "admin"
                          ? "bg-terracotta-100 dark:bg-terracotta-900/30 text-terracotta-700 dark:text-terracotta-300"
                          : "bg-clay-100 dark:bg-earth-700 text-clay-600 dark:text-clay-400"
                      }`}
                    >
                      {user.role}
                    </span>
                    <span className="text-xs text-clay-500 dark:text-clay-400 whitespace-nowrap">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-2 flex items-center gap-3">
                  {confirmDeleteUserId === user.id ? (
                    <>
                      <span className="text-xs text-clay-600 dark:text-clay-400">Delete this user?</span>
                      <button
                        onClick={() => deleteUser(user.id)}
                        disabled={isDeletingUser}
                        className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                      >
                        {isDeletingUser ? "Deleting…" : "Yes, Delete"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteUserId(null)}
                        className="text-sm text-clay-500 dark:text-clay-400 hover:underline"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => toggleAdmin(user.id, user.role)}
                        className="text-sm text-terracotta-600 dark:text-terracotta-400 hover:underline"
                      >
                        {user.role === "admin" ? "Remove Admin" : "Make Admin"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteUserId(user.id)}
                        className="text-sm text-red-500 dark:text-red-400 hover:underline"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="px-4 py-8 text-center text-clay-500 dark:text-clay-500 text-sm">
                No users yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
