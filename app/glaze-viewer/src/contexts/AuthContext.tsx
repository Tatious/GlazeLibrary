/**
 * Auth Context
 * Provides authentication state throughout the app
 */

import {
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword as firebaseUpdatePassword,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { formatAuthError } from "../lib/authErrors";
import type { Profile } from "../types/firestore";
import { AuthContext, type AuthContextType } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      try {
        const snap = await getDoc(doc(db, "profiles", userId));
        if (!snap.exists()) return null;
        return snap.data() as Profile;
      } catch (err) {
        console.error("Profile fetch error:", err);
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const fetchedProfile = await fetchProfile(firebaseUser.uid);
        setProfile(fetchedProfile);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, [fetchProfile]);

  // Sign up with invite code — validation and user creation happen server-side
  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    inviteCode: string,
  ): Promise<{ error: Error | null }> => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName, inviteCode }),
      });
      const json = await res.json();
      if (!res.ok) {
        return { error: new Error(json.error || "Signup failed") };
      }
      // Server created the user; now sign in to establish Firebase auth state
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Trigger the verification email. The Admin SDK created the user
      // silently, so this is the only place that asks Firebase to send one.
      // Non-fatal: account already exists, user can resend later.
      try {
        await sendEmailVerification(cred.user);
      } catch (verifyErr) {
        console.warn("Failed to send verification email:", verifyErr);
      }
      return { error: null };
    } catch (err) {
      return { error: new Error(formatAuthError(err, "Signup failed")) };
    }
  };

  // Sign in
  const signIn = async (
    email: string,
    password: string,
  ): Promise<{ error: Error | null }> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (err) {
      return { error: new Error(formatAuthError(err, "Sign in failed")) };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  // Send a password reset email
  const resetPassword = async (
    email: string,
  ): Promise<{ error: Error | null }> => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { error: null };
    } catch (err) {
      return { error: new Error(formatAuthError(err, "Password reset failed")) };
    }
  };

  // Resend the email-verification link for the current user
  const resendVerificationEmail = async (): Promise<{
    error: Error | null;
  }> => {
    if (!user) {
      return { error: new Error("Not authenticated") };
    }
    try {
      await sendEmailVerification(user);
      return { error: null };
    } catch (err) {
      return {
        error: new Error(formatAuthError(err, "Could not send verification email")),
      };
    }
  };

  // Update profile
  const updateProfile = async (
    updates: Partial<Profile>,
  ): Promise<{ error: Error | null }> => {
    if (!user) {
      return { error: new Error("Not authenticated") };
    }

    try {
      await updateDoc(doc(db, "profiles", user.uid), updates as never);
      if (profile) {
        setProfile({ ...profile, ...updates });
      }
      return { error: null };
    } catch (err) {
      return { error: new Error(formatAuthError(err, "Update failed")) };
    }
  };

  // Change email — sends a verification link to the new address; the auth
  // email only swaps after the user clicks it. Requires recent auth, so we
  // re-authenticate with the current password first.
  const updateEmail = async (
    newEmail: string,
    currentPassword: string,
  ): Promise<{ error: Error | null }> => {
    if (!user || !user.email) {
      return { error: new Error("Not authenticated") };
    }
    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword,
      );
      await reauthenticateWithCredential(user, credential);
      await verifyBeforeUpdateEmail(user, newEmail);
      return { error: null };
    } catch (err) {
      return { error: new Error(formatAuthError(err, "Email update failed")) };
    }
  };

  // Change password — same reauth dance as email change.
  const updatePassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<{ error: Error | null }> => {
    if (!user || !user.email) {
      return { error: new Error("Not authenticated") };
    }
    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword,
      );
      await reauthenticateWithCredential(user, credential);
      await firebaseUpdatePassword(user, newPassword);
      return { error: null };
    } catch (err) {
      return { error: new Error(formatAuthError(err, "Password update failed")) };
    }
  };

  // Delete own account
  const deleteAccount = async (): Promise<{ error: Error | null }> => {
    if (!user) {
      return { error: new Error("Not authenticated") };
    }
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        return { error: new Error(json.error || "Failed to delete account") };
      }
      await firebaseSignOut(auth);
      return { error: null };
    } catch (err) {
      return { error: new Error(formatAuthError(err, "Failed to delete account")) };
    }
  };

  // Refresh profile from server
  const refreshProfile = useCallback(async () => {
    if (!user) return;

    try {
      const freshProfile = await fetchProfile(user.uid);
      setProfile(freshProfile);
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  }, [user, fetchProfile]);

  const value: AuthContextType = {
    user,
    profile,
    isLoading,
    isAdmin: profile?.role === "admin",
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    updateEmail,
    updatePassword,
    resendVerificationEmail,
    deleteAccount,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
