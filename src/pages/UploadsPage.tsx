/**
 * Uploads Page
 * Lists every result the user has uploaded (layered combinations AND
 * single-glaze results) in a grid.
 */

import { Link } from "react-router-dom";
import { useGlazes } from "../hooks/useGlazeData";
import { useUserUploads } from "../hooks/useUploads";
import { toUploadCard } from "../api/uploadsApi";
import { useAuth } from "../hooks/useAuth";
import { EmptyState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { Image, Plus } from "../components/Icons";
import { prefixCdnUrl } from "../utils/glazeUtils";

export function UploadsPage() {
  const { user } = useAuth();
  const { data: glazes = [] } = useGlazes();
  const { data: uploads = [], isLoading } = useUserUploads(user?.uid);

  const cards = uploads.map((u) => toUploadCard(u, glazes));
  const totalEntries = cards.length;

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200">
            Please sign in to view your uploads
          </h2>
          <Link
            to="/login"
            className="mt-4 inline-block text-terracotta-600 dark:text-terracotta-400 hover:underline"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Spinner size="md" layout="inline" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-8">
      {/* Header */}
      <div className="px-4 py-3 border-b border-clay-200 dark:border-earth-700 sticky top-12 sm:top-14 bg-white dark:bg-earth-800 z-10">
        <div className="max-w-2xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-2">
            <Link
              to={`/user/${user.uid}`}
              className="text-clay-500 dark:text-clay-400 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition-colors"
            >
              Profile
            </Link>
            <span className="text-clay-400 dark:text-clay-500">›</span>
            <span className="text-clay-600 dark:text-clay-300">Uploads</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-clay-800 dark:text-clay-200">
                Uploads
              </h1>
              <p className="text-sm text-clay-500 dark:text-clay-400">
                {totalEntries} {totalEntries === 1 ? "entry" : "entries"}
              </p>
            </div>
            <Link
              to="/upload"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white font-medium transition-colors text-sm whitespace-nowrap shrink-0"
            >
              <Plus />
              Upload New
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        {cards.length === 0 ? (
          <EmptyState
            variant="bare"
            icon={<Image size="2xl" strokeWidth={1.5} />}
            title="No uploads yet"
            description="You haven't uploaded any results yet."
            action={
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white font-medium transition-colors"
              >
                Upload Your First Result
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {cards.map((card) => (
              <Link
                key={card.entryId}
                to={card.linkTo}
                className="group block"
              >
                <div className="aspect-square rounded-lg overflow-hidden bg-clay-100 dark:bg-earth-700 mb-2 ring-2 ring-transparent group-hover:ring-terracotta-400 transition-all relative">
                  {card.imageUrl ? (
                    <img
                      src={prefixCdnUrl(card.imageUrl)}
                      alt={card.displayName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-clay-400 dark:text-earth-500">
                      <Image size="2xl" />
                    </div>
                  )}
                  {card.isSingleGlaze && (
                    <span className="absolute top-1 left-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-clay-900/70 text-white">
                      Single
                    </span>
                  )}
                </div>
                <p className="text-sm text-clay-700 dark:text-clay-300 font-medium group-hover:text-terracotta-600 dark:group-hover:text-terracotta-400 line-clamp-2">
                  {card.displayName}
                </p>
                <p className="text-xs text-clay-500 dark:text-clay-400">
                  {card.meta}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
