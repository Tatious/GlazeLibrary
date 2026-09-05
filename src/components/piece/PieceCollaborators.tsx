import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, X } from "lucide-react";
import {
  invitePieceCollaborator,
  listPieceCollaborators,
  removePieceCollaborator,
} from "../../api/piecesApi";
import { Input } from "../Input";
import { UserAvatar } from "../UserAvatar";

export function PieceCollaborators({ pieceId }: { pieceId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["pieces", "collaborators", pieceId] as const;
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const { data: collaborators = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listPieceCollaborators(pieceId),
  });
  const invite = useMutation({
    mutationFn: (inviteEmail: string) => invitePieceCollaborator(pieceId, inviteEmail),
    onSuccess: () => {
      setEmail("");
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
    const trimmed = email.trim();
    if (!trimmed || invite.isPending) return;
    setMessage(null);
    invite.mutate(trimmed);
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
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Collaborator email"
          aria-label="Collaborator email"
        />
        <button
          type="submit"
          disabled={!email.trim() || invite.isPending}
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