import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { HomePage } from "./pages/HomePage";
import { CombinationDetailPage } from "./pages/CombinationDetailPage";
import { GlazesPage } from "./pages/GlazesPage";
import { GlazeDetailPage } from "./pages/GlazeDetailPage";
import { GlazeCombinationsPage } from "./pages/GlazeCombinationsPage";
import { ExplorePage } from "./pages/ExplorePage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { AdminPage } from "./pages/AdminPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UploadCombinationPage } from "./pages/UploadCombinationPage";
import { UserProfilePage } from "./pages/UserProfilePage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import { CollectionDetailPage } from "./pages/CollectionDetailPage";
import { PiecesPage } from "./pages/PiecesPage";
import { PieceDetailPage } from "./pages/PieceDetailPage";
import { UploadsPage } from "./pages/UploadsPage";
import { Navigation } from "./components/Navigation";
import { ScrollManager } from "./components/ScrollManager";
import { AuthProvider } from "./contexts/AuthContext";
import "./App.css";

// Disable browser's automatic scroll restoration - we handle it ourselves
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

// Route hierarchy for determining navigation direction
// Matches visual tab layout: Glazes | Combinations | Collections | Pieces
const routeOrder: Record<string, number> = {
  "/glazes": 1,
  "/combinations": 2,
  "/collections": 3,
  "/pieces": 4,
  "/glaze": 10,
  "/combination": 20,
};

function getRouteDepth(pathname: string): number {
  if (routeOrder[pathname] !== undefined) return routeOrder[pathname];
  if (pathname.startsWith("/combination/")) return routeOrder["/combination"];
  if (pathname.startsWith("/glaze/") && pathname.includes("/combinations"))
    return routeOrder["/glaze"] + 1;
  if (pathname.startsWith("/glaze/")) return routeOrder["/glaze"];
  return 0;
}

function App() {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const [, setDirection] = useState<1 | -1>(1);

  useEffect(() => {
    const prevDepth = getRouteDepth(prevPathRef.current);
    const currentDepth = getRouteDepth(location.pathname);
    // Forward (deeper) = -1 (pages move LEFT), Back = 1 (pages move RIGHT)
    setDirection(currentDepth > prevDepth ? -1 : 1);
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  // Simple fade transition - reliable and clean
  const variants = {
    enter: {
      opacity: 0,
    },
    center: {
      opacity: 1,
    },
    exit: {
      opacity: 0,
    },
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-clay-50 dark:bg-earth-900 overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
        <ScrollManager />
        <Navigation />
        {/* Spacer for fixed header + safe area */}
        <div
          style={{ height: "calc(env(safe-area-inset-top) + 3rem)" }}
          className="sm:hidden"
        />
        <div
          style={{ height: "calc(env(safe-area-inset-top) + 3.5rem)" }}
          className="hidden sm:block"
        />
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={location.pathname}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.08, ease: "easeOut" }}
          >
            <Routes location={location}>
              <Route path="/" element={<Navigate to="/glazes" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/upload" element={<UploadCombinationPage />} />
              <Route path="/user/:userId" element={<UserProfilePage />} />
              <Route path="/combinations" element={<HomePage />} />
              <Route
                path="/combination/:id"
                element={<CombinationDetailPage />}
              />
              <Route path="/glazes" element={<GlazesPage />} />
              <Route path="/glazes/shop" element={<ExplorePage />} />
              <Route
                path="/glaze/:id/combinations"
                element={<GlazeCombinationsPage />}
              />
              <Route path="/glaze/:id" element={<GlazeDetailPage />} />
              {/* Swipe flow lives at /discover/use \u2014 reached from a piece
                  or collection, never from the nav. */}
              <Route path="/discover/use" element={<DiscoverPage />} />
              <Route path="/collections" element={<CollectionsPage />} />
              <Route path="/collections/:id" element={<CollectionDetailPage />} />
              <Route path="/pieces" element={<PiecesPage />} />
              <Route path="/pieces/:id" element={<PieceDetailPage />} />
              <Route path="/uploads" element={<UploadsPage />} />
              <Route path="*" element={<Navigate to="/glazes" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
    </AuthProvider>
  );
}

export default App;
