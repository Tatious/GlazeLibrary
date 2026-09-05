/**
 * Auth Context object + type.
 *
 * Kept separate from AuthContext.tsx so that the provider file only exports
 * components (required for React Fast Refresh).
 */

import { createContext } from "react";
import type { User } from "firebase/auth";
import type { Profile } from "../types/firestore";

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    inviteCode: string,
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updateProfile: (
    updates: Partial<Profile>,
  ) => Promise<{ error: Error | null }>;
  updateEmail: (
    newEmail: string,
    currentPassword: string,
  ) => Promise<{ error: Error | null }>;
  updatePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ error: Error | null }>;
  resendVerificationEmail: () => Promise<{ error: Error | null }>;
  deleteAccount: () => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
