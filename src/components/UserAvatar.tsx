interface UserAvatarProps {
  name: string;
  photoDataUrl?: string | null;
  className?: string;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserAvatar({ name, photoDataUrl, className = "" }: UserAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-terracotta-500 text-white font-semibold ${className}`}
    >
      {photoDataUrl ? (
        <img src={photoDataUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name) || "U"
      )}
    </span>
  );
}