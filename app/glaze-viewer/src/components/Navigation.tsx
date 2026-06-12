/**
 * Navigation Component
 * Consistent navigation across all pages
 */

import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { UserMenu } from "./UserMenu";

export function Navigation() {
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  // Reset header visibility when route changes
  useEffect(() => {
    setIsVisible(true);
    lastScrollY.current = window.scrollY;
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollY.current;

      if (currentScrollY < 10) {
        setIsVisible(true);
      } else if (diff < -5) {
        // Scrolling up
        setIsVisible(true);
      } else if (diff > 5 && currentScrollY > 60) {
        // Scrolling down
        setIsVisible(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <header
      className={`bg-white dark:bg-earth-800 fixed top-0 left-0 right-0 z-50 border-b border-clay-200 dark:border-earth-700 transition-transform duration-300 pt-[env(safe-area-inset-top)] ${isVisible ? "translate-y-0" : "-translate-y-full"}`}
    >
      <div
        className="max-w-7xl mx-auto"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <div className="flex items-center justify-between h-12 sm:h-14">
          {/* Logo — hidden on the smallest mobile portrait to avoid
              redundancy with the Glazes tab, but kept on landscape phones
              (xsl) since they have plenty of horizontal room. */}
          <Link to="/" className="hidden xs:flex xsl:flex items-center shrink-0">
            <span className="text-lg sm:text-xl font-bold text-clay-800 dark:text-clay-200">
              Glaze Library
            </span>
          </Link>

          {/* Main Navigation - Tab Style.
              The four nouns the user actually returns to: their glazes, the
              combos catalog, their saved collections, and their active
              pieces. Swipe-style Discover is no longer a top-level tab \u2014
              it's an input method reachable from a piece or a collection. */}
          <nav className="flex items-center h-full">
            <Link
              to="/glazes"
              className={`relative h-full flex items-center px-3 sm:px-5 text-sm font-medium transition-colors ${
                isActive("/glaze")
                  ? "text-terracotta-600 dark:text-terracotta-400"
                  : "text-clay-600 dark:text-clay-400 hover:text-clay-900 dark:hover:text-clay-200"
              }`}
            >
              Glazes
              {isActive("/glaze") && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-terracotta-500 dark:bg-terracotta-400" />
              )}
            </Link>

            <Link
              to="/combinations"
              className={`relative h-full flex items-center px-3 sm:px-5 text-sm font-medium transition-colors ${
                isActive("/combination")
                  ? "text-terracotta-600 dark:text-terracotta-400"
                  : "text-clay-600 dark:text-clay-400 hover:text-clay-900 dark:hover:text-clay-200"
              }`}
            >
              <span className="hidden xs:inline xsl:inline">Combinations</span>
              <span className="xs:hidden xsl:hidden">Combos</span>
              {isActive("/combination") && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-terracotta-500 dark:bg-terracotta-400" />
              )}
            </Link>

            {/* Collections + Pieces are user-scoped surfaces. Hide them
                entirely for signed-out visitors so the nav doesn't advertise
                features that bounce them to /login. Also gated on
                `!authLoading` to avoid a brief mount-time flash where the
                tabs render before auth state resolves. */}
            {!authLoading && user && (
              <>
                <Link
                  to="/collections"
                  className={`relative h-full flex items-center px-3 sm:px-5 text-sm font-medium transition-colors ${
                    isActive("/collection")
                      ? "text-terracotta-600 dark:text-terracotta-400"
                      : "text-clay-600 dark:text-clay-400 hover:text-clay-900 dark:hover:text-clay-200"
                  }`}
                >
                  Collections
                  {isActive("/collection") && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-terracotta-500 dark:bg-terracotta-400" />
                  )}
                </Link>

                <Link
                  to="/pieces"
                  className={`relative h-full flex items-center px-3 sm:px-5 text-sm font-medium transition-colors ${
                    isActive("/piece")
                      ? "text-terracotta-600 dark:text-terracotta-400"
                      : "text-clay-600 dark:text-clay-400 hover:text-clay-900 dark:hover:text-clay-200"
                  }`}
                >
                  Pieces
                  {isActive("/piece") && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-terracotta-500 dark:bg-terracotta-400" />
                  )}
                </Link>
              </>
            )}
          </nav>

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
