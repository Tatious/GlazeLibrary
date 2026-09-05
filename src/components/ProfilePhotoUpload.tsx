import { useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { prepareProfilePhoto } from "../lib/profilePhoto";

interface ProfilePhotoUploadProps {
  hasPhoto: boolean;
  userName: string;
  onSave: (photoDataUrl: string | null) => Promise<void>;
}

export function ProfilePhotoUpload({
  hasPhoto,
  userName,
  onSave,
}: ProfilePhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (photoDataUrl: string | null) => {
    setIsBusy(true);
    setError(null);
    try {
      await onSave(photoDataUrl);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Photo could not be saved.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={`Choose profile photo for ${userName}`}
        className="sr-only"
        disabled={isBusy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setIsBusy(true);
          setError(null);
          prepareProfilePhoto(file)
            .then(onSave)
            .catch((photoError: unknown) => {
              setError(
                photoError instanceof Error
                  ? photoError.message
                  : "Photo could not be prepared.",
              );
            })
            .finally(() => setIsBusy(false));
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-clay-300 dark:border-earth-600 text-sm font-medium text-clay-700 dark:text-clay-300 hover:bg-clay-50 dark:hover:bg-earth-700 disabled:opacity-50"
        >
          <ImageUp className="w-4 h-4" />
          {isBusy ? "Saving..." : hasPhoto ? "Change photo" : "Add photo"}
        </button>
        {hasPhoto && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void save(null)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}