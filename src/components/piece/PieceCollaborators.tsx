import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, X } from "lucide-react";
import {
  invitePieceCollaborator,
  listPieceCollaborators,
  removePieceCollaborator,
  searchPiecePeople,
} from "../../api/piecesApi";
import { Input } from "../Input";
import { UserAvatar } from "../UserAvatar";
import type { UserSummary } from "../../types/models";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PieceCollaborators({ pieceId }: { pieceId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["pieces", "collaborators", pieceId] as const;
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<UserSummary | null>(null);
  const [isPickerFocused, setIsPickerFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const { data: collaborators = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listPieceCollaborators(pieceId),
  });
  const { data: people = [], isFetching: isSearching } = useQuery({
    queryKey: ["pieces", "people", pieceId, deferredSearch],
    queryFn: () => searchPiecePeople(pieceId, deferredSearch),
    enabled: deferredSearch.length >= 2 && !selectedPerson,
  });
  const invite = useMutation({
    mutationFn: (person: { userId: string } | { email: string }) =>
      invitePieceCollaborator(pieceId, person),
    onSuccess: () => {
      setSearch("");
      setSelectedPerson(null);
      setMessage("Invitation sent");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "Could not send invitation");
    },
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removePieceCollaborator(pieceId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = search.trim();
    const target = selectedPerson
      ? { userId: selectedPerson.userId }
      : EMAIL_PATTERN.test(trimmed)
        ? { email: trimmed }
        : null;
    if (!target || invite.isPending) return;
    setMessage(null);
    invite.mutate(target);
  };

  const canInvite = !!selectedPerson || EMAIL_PATTERN.test(search.trim());
  const showPicker =
    isPickerFocused && !selectedPerson && deferredSearch.length >= 2;
  const activePerson = people[activeIndex];

  const choosePerson = (person: UserSummary) => {
    setSelectedPerson(person);
    setSearch(person.displayName);
    setIsPickerFocused(false);
  };

  return (
    <section className="bg-white dark:bg-earth-800 rounded-xl p-6 shadow-sm border-2 border-clay-200 dark:border-earth-600 mb-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-200">People</h2>
        <p className="mt-0.5 text-xs text-clay-500 dark:text-clay-400">
          Editors can change this piece, but only you can archive or delete it.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            autoComplete="off"
            value={search}
            onFocus={() => setIsPickerFocused(true)}
            onBlur={() => setIsPickerFocused(false)}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedPerson(null);
              setIsPickerFocused(true);
              setActiveIndex(0);
              setMessage(null);
            }}
            onKeyDown={(event) => {
              if (!showPicker) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) =>
                  people.length ? (index + 1) % people.length : 0,
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) =>
                  people.length ? (index - 1 + people.length) % people.length : 0,
                );
              } else if (event.key === "Enter" && activePerson) {
                event.preventDefault();
                choosePerson(activePerson);
              } else if (event.key === "Escape") {
                event.preventDefault();
                setIsPickerFocused(false);
              }
            }}
            placeholder="Search people or enter email"
            aria-label="Search people or enter email"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showPicker}
            aria-controls="piece-people-listbox"
            aria-activedescendant={
              showPicker && activePerson
                ? `piece-person-${activePerson.userId}`
                : undefined
            }
          />
          {showPicker && (
            <div
              id="piece-people-listbox"
              role="listbox"
              aria-label="People"
              className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border-2 border-clay-200 dark:border-earth-600 bg-white dark:bg-earth-800 shadow-lg"
            >
              {isSearching ? (
                <p className="px-3 py-3 text-sm text-clay-500 dark:text-clay-400">
                  Searching...
                </p>
              ) : people.length > 0 ? (
                people.map((person, index) => (
                  <button
                    key={person.userId}
                    id={`piece-person-${person.userId}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choosePerson(person)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${
                      index === activeIndex
                        ? "bg-clay-50 dark:bg-earth-700"
                        : "hover:bg-clay-50 dark:hover:bg-earth-700"
                    }`}
                  >
                    <UserAvatar
                      name={person.displayName}
                      photoDataUrl={person.photoDataUrl}
                      className="w-9 h-9 text-xs"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-clay-800 dark:text-clay-200">
                        {person.displayName}
                      </span>
                      {person.email && (
                        <span className="block truncate text-xs text-clay-500 dark:text-clay-400">
                          {person.email}
                        </span>
                      )}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-3 text-sm text-clay-500 dark:text-clay-400">
                  {EMAIL_PATTERN.test(search.trim())
                    ? "Press Invite to use this email"
                    : "No matching people"}
                </p>
              )}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={!canInvite || invite.isPending}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-terracotta-600 hover:bg-terracotta-700 text-white text-sm font-medium disabled:opacity-50 sm:shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          {invite.isPending ? "Sending..." : "Invite"}
        </button>
      </form>
      {message && (
        <p
          role="status"
          className={`mt-2 text-sm ${invite.isError ? "text-red-600 dark:text-red-400" : "text-moss-700 dark:text-moss-300"}`}
        >
          {message}
        </p>
      )}

      {!isLoading && collaborators.length > 0 && (
        <ul className="mt-5 divide-y divide-clay-200 dark:divide-earth-600 border-t border-clay-200 dark:border-earth-600">
          {collaborators.map((collaborator) => (
            <li key={collaborator.userId} className="flex items-center gap-3 py-3">
              <UserAvatar
                name={collaborator.profile.displayName}
                photoDataUrl={collaborator.profile.photoDataUrl}
                className="w-9 h-9 text-xs"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-clay-800 dark:text-clay-200 truncate">
                  {collaborator.profile.displayName}
                </p>
                <p className="text-xs text-clay-500 dark:text-clay-400 truncate">
                  {collaborator.status === "pending" ? "Invitation pending" : "Can edit"}
                  {collaborator.profile.email ? ` · ${collaborator.profile.email}` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate(collaborator.userId)}
                title={collaborator.status === "pending" ? "Cancel invitation" : "Remove editor"}
                aria-label={collaborator.status === "pending" ? "Cancel invitation" : `Remove ${collaborator.profile.displayName}`}
                className="p-2 rounded-lg text-clay-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}