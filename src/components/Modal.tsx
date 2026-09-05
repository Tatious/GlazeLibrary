/**
 * Reusable modal/dialog wrapper.
 *
 * Routes through the shared `PickerSurface` so every modal in the app
 * gets the same responsive treatment as the pickers:
 *   - desktop & landscape-phone (`xsl`)  → centered dialog
 *   - mobile portrait                    → bottom slide-sheet w/ swipe-to-dismiss
 *
 * `ConfirmAction` is built on top of this. Use Modal directly when you
 * need a form modal with custom body / footer; use ConfirmAction when
 * you only need a destructive confirm prompt.
 */

import { type ReactNode } from "react";
import { PickerSurface } from "./PickerSurface";
import { PickerPanelBody } from "./PickerPanelBody";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Constrains the dialog width. Mirrors PickerSurface's dialogSize. */
  size?: "sm" | "md" | "lg";
  /** If false, backdrop tap / Esc / swipe-down won't dismiss. Use for
   *  pending-state confirms where the user shouldn't accidentally bail. */
  closeOnBackdrop?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "sm",
  closeOnBackdrop = true,
}: ModalProps) {
  return (
    <PickerSurface
      isOpen={isOpen}
      onClose={closeOnBackdrop ? onClose : () => {}}
      dialogSize={size}
      ariaLabel={typeof title === "string" ? title : "Modal"}
    >
      <PickerPanelBody
        header={
          title ? (
            <div className="px-6 py-4 border-b border-clay-200 dark:border-earth-600">
              <h2 className="text-lg font-semibold text-clay-800 dark:text-clay-100">
                {title}
              </h2>
            </div>
          ) : undefined
        }
        footer={
          footer ? (
            <div className="px-6 py-4 bg-clay-50 dark:bg-earth-700/50 border-t border-clay-200 dark:border-earth-600 flex justify-end gap-3">
              {footer}
            </div>
          ) : undefined
        }
      >
        {children}
      </PickerPanelBody>
    </PickerSurface>
  );
}
