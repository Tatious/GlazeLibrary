/**
 * User Menu Component
 * Shows login/signup links when logged out, user dropdown when logged in
 */

import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { STORAGE_KEYS } from "../config/storageKeys";
import { User } from "./Icons";

export function UserMenu() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
    navigate("/glazes");
  };

  // Not logged in - show login link as circular button to match logged-in avatar
  if (!user) {
    return (
      <Link
        to="/login"
        onClick={() =>
          sessionStorage.setItem(
            STORAGE_KEYS.LOGIN_REDIRECT,
            location.pathname + location.search,
          )
        }
        className="flex items-center justify-center w-8 h-8 rounded-full text-clay-600 dark:text-clay-400 hover:bg-clay-100 dark:hover:bg-earth-700 transition-colors border border-clay-300 dark:border-earth-600"
        title="Sign In"
      >
        <User />
      </Link>
    );
  }

  // Logged in - show user dropdown
  const displayName =
    profile?.display_name || user.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-clay-100 dark:hover:bg-earth-700 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-terracotta-500 flex items-center justify-center text-white text-xs font-medium">
          {initials}
        </div>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white dark:bg-earth-800 shadow-lg border-2 border-clay-200 dark:border-earth-600 z-50 overflow-hidden">
          {/* User info - clickable to profile */}
          <Link
            to={`/user/${user.uid}`}
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 border-b border-clay-200 dark:border-earth-600 hover:bg-clay-50 dark:hover:bg-earth-700 transition-colors"
          >
            <p className="text-sm font-medium text-clay-800 dark:text-clay-200 truncate">
              {displayName}
            </p>
            <p className="text-xs text-clay-500 dark:text-clay-400 truncate">
              {user.email}
            </p>
            {isAdmin && (
              <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-terracotta-100 dark:bg-terracotta-900/30 text-terracotta-700 dark:text-terracotta-300 rounded">
                Admin
              </span>
            )}
          </Link>

          {/* Upload link */}
          <Link
            to="/upload"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 text-sm text-clay-700 dark:text-clay-300 hover:bg-clay-50 dark:hover:bg-earth-700"
          >
            Share Results
          </Link>

          {/* Admin link */}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 text-sm text-clay-700 dark:text-clay-300 hover:bg-clay-50 dark:hover:bg-earth-700"
            >
              Admin Dashboard
            </Link>
          )}

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 text-sm text-clay-700 dark:text-clay-300 hover:bg-clay-50 dark:hover:bg-earth-700"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
