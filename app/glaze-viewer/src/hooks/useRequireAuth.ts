/**
 * Redirect to `/login` (carrying the current pathname as `from` state) when
 * the user is signed out and auth has finished loading. Returns the user so
 * components can also early-return on `!user` for the loading state.
 */

import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
    }
  }, [isLoading, user, navigate, location.pathname]);

  return { user, isLoading };
}
