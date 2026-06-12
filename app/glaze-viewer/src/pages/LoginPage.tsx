/**
 * Login Page
 * Email/password login for existing users
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Alert } from "../components/Alert";
import { PageLayout } from "../components/PageLayout";
import { Input } from "../components/Input";
import { PasswordInput } from "../components/PasswordInput";
import { STORAGE_KEYS } from "../config/storageKeys";

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      // Small delay to let auth state update, then navigate
      setTimeout(() => {
        setIsLoading(false);
        // Go back to where user came from, or default to glazes
        const redirectTo =
          sessionStorage.getItem(STORAGE_KEYS.LOGIN_REDIRECT) || "/glazes";
        sessionStorage.removeItem(STORAGE_KEYS.LOGIN_REDIRECT);
        navigate(redirectTo, { replace: true });
      }, 100);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError("Enter your email above, then click \u201cForgot password?\u201d again.");
      return;
    }
    setIsSendingReset(true);
    const { error } = await resetPassword(email.trim());
    setIsSendingReset(false);
    if (error) {
      setError(error.message);
    } else {
      setInfo(
        `Password reset email sent to ${email.trim()}. Check your inbox (and spam folder).`,
      );
    }
  };

  return (
    <PageLayout maxWidth="md" padY="12">
      <div className="bg-white dark:bg-earth-800 rounded-xl p-6 shadow-sm border-2 border-clay-200 dark:border-earth-600">
        <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-200 mb-6 text-center">
          Sign In
        </h1>

        {error && (
          <Alert className="mb-4">{error}</Alert>
        )}

        {info && (
          <div className="mb-4 p-3 rounded-lg bg-terracotta-50 dark:bg-earth-700 text-sm text-clay-700 dark:text-clay-200 border border-terracotta-200 dark:border-earth-600">
            {info}
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
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1"
            >
              Password
            </label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="mt-1.5 text-right">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isSendingReset}
                className="text-xs text-terracotta-600 dark:text-terracotta-400 hover:underline disabled:opacity-50"
              >
                {isSendingReset ? "Sending\u2026" : "Forgot password?"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 active:bg-terracotta-800 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-clay-600 dark:text-clay-400">
          Have an invite code?{" "}
          <Link
            to="/signup"
            className="text-terracotta-600 dark:text-terracotta-400 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </PageLayout>
  );
}
