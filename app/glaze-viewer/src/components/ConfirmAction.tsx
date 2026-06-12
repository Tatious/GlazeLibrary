/**
 * Reusable inline / modal "confirm this action" prompt.
 *
 * Used everywhere a user does something destructive (delete an upload, delete
 * a piece, etc.). Keeps the danger button copy consistent and prevents the
 * proliferation of one-off Cancel / Confirm pairs across the app.
 *
 * Two variants:
 *   - layout="inline" (default) — sits inside whatever container called it
 *     (e.g. the bottom of a card).
 *   - layout="modal"            — full-screen backdrop + centered dialog,
 *     rendered via <Modal> so the chrome stays consistent with other dialogs.
 */

import { type ReactNode } from "react";
import { Modal } from "./Modal";

interface ConfirmActionProps {
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual tone of the confirm button. */
  tone?: "danger" | "primary";
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  layout?: "inline" | "modal";
}

export function ConfirmAction({
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "danger",
  isPending = false,
  onConfirm,
  onCancel,
  layout = "inline",
}: ConfirmActionProps) {
  const confirmClasses =
    tone === "danger"
      ? "bg-red-500 text-white hover:bg-red-600"
      : "bg-terracotta-500 text-white hover:bg-terracotta-600";
  const messageClasses =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : "text-clay-700 dark:text-clay-300";

  const buttons = (
    <div className="flex gap-2 justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        className="px-3 py-1 text-sm text-clay-600 dark:text-clay-400 hover:text-clay-800 dark:hover:text-clay-200 disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isPending}
        className={`px-3 py-1 text-sm rounded-lg transition-colors disabled:opacity-50 ${confirmClasses}`}
      >
        {isPending ? `${confirmLabel.replace(/e?$/, "ing")}…` : confirmLabel}
      </button>
    </div>
  );

  if (layout === "modal") {
    return (
      <Modal
        isOpen
        onClose={onCancel}
        closeOnBackdrop={!isPending}
        size="sm"
      >
        <div className={`text-sm mb-4 ${messageClasses}`}>{message}</div>
        {buttons}
      </Modal>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-sm ${messageClasses}`}>{message}</span>
      {buttons}
    </div>
  );
}
