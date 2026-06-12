/**
 * Signup Page
 * Create account with invite code
 */

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Alert } from "../components/Alert";
import { PageLayout } from "../components/PageLayout";
import { Input } from "../components/Input";
import { PasswordInput } from "../components/PasswordInput";

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp } = useAuth();

  // Pre-fill invite code from URL if present
  const [inviteCode, setInviteCode] = useState(searchParams.get("code") || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (!inviteCode.trim()) {
      setError("Invite code is required");
      return;
    }

    setIsLoading(true);

    const { error } = await signUp(
      email,
      password,
      displayName,
      inviteCode.trim(),
    );

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      setSignedUpEmail(email);
      setIsLoading(false);
    }
  };

  return (
    <PageLayout maxWidth="md" padY="12">
      <div className="bg-white dark:bg-earth-800 rounded-xl p-6 shadow-sm border-2 border-clay-200 dark:border-earth-600">
        {signedUpEmail ? (
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-200">
              Welcome to Glaze Library!
            </h1>
            <p className="text-sm text-clay-600 dark:text-clay-400">
              We sent a verification link to{" "}
              <span className="font-medium text-clay-800 dark:text-clay-200">
                {signedUpEmail}
              </span>
              . Click it to confirm your email — it may take a minute to arrive, and check spam if you don’t see it.
            </p>
            <p className="text-xs text-clay-500 dark:text-clay-400">
              You can keep using the app while you verify.
            </p>
            <button
              type="button"
              onClick={() => navigate("/glazes", { replace: true })}
              className="w-full py-2.5 px-4 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 active:bg-terracotta-800 text-white font-medium transition-colors"
            >
              Continue to Glazes
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-clay-800 dark:text-clay-200 mb-6 text-center">
              Create Account
            </h1>

            {error && <Alert className="mb-4">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="inviteCode"
              className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1"
            >
              Invite Code
            </label>
            <Input
              id="inviteCode"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              placeholder="Enter your invite code"
            />
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
              placeholder="How should we call you?"
            />
          </div>

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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-clay-700 dark:text-clay-300 mb-1"
            >
              Confirm Password
            </label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 active:bg-terracotta-800 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-clay-600 dark:text-clay-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-terracotta-600 dark:text-terracotta-400 hover:underline"
          >
            Sign in
          </Link>
        </p>
          </>
        )}
      </div>
    </PageLayout>
  );
}
