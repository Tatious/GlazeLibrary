import { Routes, Route, Navigate } from "react-router-dom";
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

function App() {
  return (
    <AuthProvider>
      <div className="relative min-h-screen bg-clay-50 dark:bg-earth-900 overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
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
        {/* Pages swap SYNCHRONOUSLY — the shared-element photo morph
            (useImageMorph) is the only transition. A synchronous <Routes> swap
            avoids the blank frame that AnimatePresence mode="wait" left between
            unmounting the old page and painting the new one (that gap flashed on
            desktop and showed a blank page during the iOS back-swipe). Forward
            still lands correctly because ScrollManager resets scroll in a LAYOUT
            effect — before the incoming detail hero measures its rect — and the
            reverse morph is a document-level overlay that needs no page ordering. */}
        <Routes>
          <Route path="/" element={<Navigate to="/glazes" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/upload" element={<UploadCombinationPage />} />
          <Route path="/user/:userId" element={<UserProfilePage />} />
          <Route path="/combinations" element={<HomePage />} />
          <Route path="/combination/:id" element={<CombinationDetailPage />} />
          <Route path="/glazes" element={<GlazesPage />} />
          <Route path="/glazes/shop" element={<ExplorePage />} />
          <Route
            path="/glaze/:id/combinations"
            element={<GlazeCombinationsPage />}
          />
          <Route path="/glaze/:id" element={<GlazeDetailPage />} />
          {/* Swipe flow lives at /discover/use — reached from a piece or
              collection, never from the nav. */}
          <Route path="/discover/use" element={<DiscoverPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collections/:id" element={<CollectionDetailPage />} />
          <Route path="/pieces" element={<PiecesPage />} />
          <Route path="/pieces/:id" element={<PieceDetailPage />} />
          <Route path="/uploads" element={<UploadsPage />} />
          <Route path="*" element={<Navigate to="/glazes" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
