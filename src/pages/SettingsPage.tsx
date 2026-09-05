/**
 * Settings Page
 * User profile settings only
 */

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Alert } from "../components/Alert";
import { PageLayout } from "../components/PageLayout";
import { Input } from "../components/Input";
import { PasswordInput } from "../components/PasswordInput";
import { ChevronRight } from "../components/Icons";

export function SettingsPage() {
  const {
    user,
    profile,
    isLoading: authLoading,
    updateProfile,
    updateEmail,
    updatePassword,
    resendVerificationEmail,
    deleteAccount,
  } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Refresh the cached emailVerified flag once on mount — the value on
  // `auth.currentUser` is whatever it was at sign-in time.
  useEffect(() => {
    if (user && !user.emailVerified) {
      user.reload().catch(() => {});
    }
  }, [user]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Initialize form with current profile
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsSaving(true);

    const { error } = await updateProfile({ display_name: displayName.trim() });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "Profile updated!" });
    }

    setIsSaving(false);
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setDeleteError(null);
    const { error } = await deleteAccount();
    if (error) {
      setDeleteError(error.message);
      setIsDeletingAccount(false);
    } else {
      navigate("/", { replace: true });
    }
  };

  const resetEmailForm = () => {
    setIsEditingEmail(false);
    setNewEmail("");
    setEmailPassword("");
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMessage(null);

    const trimmed = newEmail.trim();
    if (!trimmed || trimmed === user?.email) {
      setEmailMessage({ type: "error", text: "Enter a different email address." });
      return;
    }

    setIsUpdatingEmail(true);
    const { error } = await updateEmail(trimmed, emailPassword);
    setIsUpdatingEmail(false);

    if (error) {
      setEmailMessage({ type: "error", text: error.message });
      return;
    }

    setEmailMessage({
      type: "success",
      text: `Verification link sent to ${trimmed}. Your sign-in email stays ${user?.email} until you click the link in that inbox.`,
    });
    setIsEditingEmail(false);
    setNewEmail("");
    setEmailPassword("");
  };

  const resetPasswordForm = () => {
    setIsEditingPassword(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({
        type: "error",
        text: "New password must be at least 6 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords don’t match." });
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordMessage({
        type: "error",
        text: "New password must be different from your current one.",
      });
      return;
    }

    setIsUpdatingPassword(true);
    const { error } = await updatePassword(currentPassword, newPassword);
    setIsUpdatingPassword(false);

    if (error) {
      setPasswordMessage({ type: "error", text: error.message });
      return;
    }

    setPasswordMessage({ type: "success", text: "Password updated." });
    resetPasswordForm();
  };

  const handleResendVerification = async () => {
    setVerificationMessage(null);
    setIsSendingVerification(true);
    const { error } = await resendVerificationEmail();
    setIsSendingVerification(false);
    if (error) {
      setVerificationMessage({ type: "error", text: error.message });
    } else {
      setVerificationMessage({
        type: "success",
        text: `Verification link sent to ${user?.email}. Check your inbox (and spam).`,
      });
    }
  };

  if (authLoading) {
    return (
      <PageLayout maxWidth="md" padY="12">
        <div className="text-center text-clay-600 dark:text-clay-400">
          Loading...
        </div>
      </PageLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <PageLayout maxWidth="2xl" padY="12">
      {/* Page-flush title — matches every other detail page. Sections below
          are separated by dividers instead of being wrapped in a card,
          which keeps the page consistent with Glaze / Combination / Piece
          detail layouts. */}
      <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-200 mb-6">
        Profile Settings
      </h1>

      {message && (
        <Alert
          variant={message.type === "success" ? "success" : "error"}
          className="mb-4"
        >
          {message.text}
        </Alert>
      )}

        {user && !user.emailVerified && (
          <div className="mb-4 p-3 rounded-lg bg-butter-100 dark:bg-butter-900/30 border border-butter-300 dark:border-butter-700/50">
            <p className="text-sm text-clay-800 dark:text-clay-200 font-medium">
              Your email isn’t verified yet.
            </p>
            <p className="mt-1 text-xs text-clay-600 dark:text-clay-400">
              We sent a verification link to {user.email} when you signed up.
              If you didn’t get it, resend below.
            </p>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isSendingVerification}
                className="text-xs font-medium text-terracotta-700 dark:text-terracotta-300 hover:underline disabled:opacity-50"
              >
                {isSendingVerification ? "Sending…" : "Resend verification email"}
              </button>
            </div>
            {verificationMessage && (
              <Alert
                variant={verificationMessage.type === "success" ? "success" : "error"}
                className="mt-2"
              >
                {verificationMessage.text}
              </Alert>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1"
            >
              Email
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                value={user.email || ""}
                disabled
                className={`w-full px-4 py-2 ${user.emailVerified ? "pr-20" : ""} rounded-lg border-2 border-clay-200 dark:border-earth-600 bg-clay-50 dark:bg-earth-700 text-clay-500 dark:text-clay-400 cursor-not-allowed`}
              />
              {user.emailVerified && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 shrink-0 px-2 py-0.5 text-[10px] font-medium rounded bg-moss-100 dark:bg-moss-900/30 text-moss-700 dark:text-moss-300">
                  Verified
                </span>
              )}
            </div>
            {emailMessage && (
              <Alert
                variant={emailMessage.type === "success" ? "success" : "error"}
                className="mt-2"
              >
                {emailMessage.text}
              </Alert>
            )}
            {isEditingEmail ? (
              <div className="mt-3 space-y-3 rounded-lg border border-clay-200 dark:border-earth-600 p-3">
                <div>
                  <label
                    htmlFor="newEmail"
                    className="block text-xs font-medium text-clay-700 dark:text-clay-300 mb-1"
                  >
                    New email
                  </label>
                  <Input
                    id="newEmail"
                    type="email"
                    autoComplete="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="emailPassword"
                    className="block text-xs font-medium text-clay-700 dark:text-clay-300 mb-1"
                  >
                    Current password
                  </label>
                  <PasswordInput
                    id="emailPassword"
                    autoComplete="current-password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleEmailSubmit}
                    disabled={isUpdatingEmail || !newEmail.trim() || !emailPassword}
                    className="px-3 py-1.5 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 active:bg-terracotta-800 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdatingEmail ? "Sending…" : "Send verification link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetEmailForm();
                      setEmailMessage(null);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-clay-300 dark:border-earth-600 text-clay-700 dark:text-clay-300 text-sm font-medium hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-clay-500 dark:text-clay-500">
                  We’ll email a confirmation link to the new address. Your
                  current email keeps working until you click that link.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsEditingEmail(true);
                  setEmailMessage(null);
                }}
                className="mt-2 text-xs font-medium text-terracotta-600 dark:text-terracotta-400 hover:underline"
              >
                Change email
              </button>
            )}
          </div>

          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1"
            >
              Display Name
            </label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSaving || displayName.trim() === profile?.display_name}
            className="w-full py-2.5 px-4 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 active:bg-terracotta-800 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </form>

        {/* Change password */}
        <div className="mt-6 pt-6 border-t border-clay-200 dark:border-earth-600">
          <h2 className="text-base font-semibold text-clay-800 dark:text-clay-200 mb-2">
            Password
          </h2>
          {passwordMessage && (
            <Alert
              variant={passwordMessage.type === "success" ? "success" : "error"}
              className="mb-3"
            >
              {passwordMessage.text}
            </Alert>
          )}
          {isEditingPassword ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-3 rounded-lg border border-clay-200 dark:border-earth-600 p-3">
              <div>
                <label
                  htmlFor="currentPassword"
                  className="block text-xs font-medium text-clay-700 dark:text-clay-300 mb-1"
                >
                  Current password
                </label>
                <PasswordInput
                  id="currentPassword"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-xs font-medium text-clay-700 dark:text-clay-300 mb-1"
                >
                  New password
                </label>
                <PasswordInput
                  id="newPassword"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label
                  htmlFor="confirmNewPassword"
                  className="block text-xs font-medium text-clay-700 dark:text-clay-300 mb-1"
                >
                  Confirm new password
                </label>
                <PasswordInput
                  id="confirmNewPassword"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={
                    isUpdatingPassword ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                  className="px-3 py-1.5 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 active:bg-terracotta-800 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingPassword ? "Updating…" : "Update password"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetPasswordForm();
                    setPasswordMessage(null);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-clay-300 dark:border-earth-600 text-clay-700 dark:text-clay-300 text-sm font-medium hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsEditingPassword(true);
                setPasswordMessage(null);
              }}
              className="text-xs font-medium text-terracotta-600 dark:text-terracotta-400 hover:underline"
            >
              Change password
            </button>
          )}
        </div>

        {/* Link to profile */}
        <div className="mt-6 pt-6 border-t border-clay-200 dark:border-earth-600">
          <Link
            to={`/user/${user.uid}`}
            className="flex items-center justify-between p-4 rounded-xl border border-clay-200 dark:border-earth-600 hover:border-terracotta-300 dark:hover:border-terracotta-600 transition-colors group"
          >
            <div>
              <p className="font-medium text-clay-800 dark:text-clay-200 group-hover:text-terracotta-600 dark:group-hover:text-terracotta-400">
                View Your Profile
              </p>
              <p className="text-sm text-clay-500 dark:text-clay-400">
                See your saved projects and uploads
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-clay-400 group-hover:text-terracotta-500" />
          </Link>
        </div>

        {/* Delete Account */}
        <div className="mt-6 pt-6 border-t border-clay-200 dark:border-earth-600">
          <h2 className="text-base font-semibold text-red-600 dark:text-red-400 mb-2">
            Delete Account
          </h2>
          <p className="text-sm text-clay-500 dark:text-clay-400 mb-4">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          {deleteError && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400">{deleteError}</p>
          )}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-clay-700 dark:text-clay-300">Are you sure?</span>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isDeletingAccount ? "Deleting…" : "Yes, Delete My Account"}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                className="px-4 py-2 rounded-lg border border-clay-300 dark:border-earth-600 text-clay-700 dark:text-clay-300 text-sm font-medium hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Delete Account
            </button>
          )}
        </div>
    </PageLayout>
  );
}
