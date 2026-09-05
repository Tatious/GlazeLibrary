/**
 * `<PickerPanelBody>` — the standard panel-body chrome for simple
 * `<PickerSurface>` dialogs/sheets (currently `<Modal>`).
 *
 * Provides the three-row layout (header / scrollable body / footer) with
 * consistent sizing so the panel behaves the same regardless of content.
 * The wrapper is `h-full` (not `max-h-full`) so the panel fills its
 * container — that's what gives the bottom sheet a stable measured height
 * and gives the scroll region a real overflow area.
 *
 * `<Combobox>` intentionally does NOT use this: its panel body has
 * listbox semantics (`role="listbox"` on the scroll container, sticky
 * group headers, a search-in-header row, a multi-select footer) that
 * don't map cleanly onto these generic slots. Keeping them separate is
 * deliberate — don't force them together.
 */

import type { ReactNode } from "react";

interface PickerPanelBodyProps {
  /** Sticky top region: title row, etc. */
  header?: ReactNode;
  /** Sticky bottom region: action buttons. */
  footer?: ReactNode;
  /** Main scrollable content. */
  children: ReactNode;
  /** Padding for the scrollable body. Defaults to `px-6 py-4`. */
  bodyPadding?: string;
}

export function PickerPanelBody({
  header,
  footer,
  children,
  bodyPadding = "px-6 py-4",
}: PickerPanelBodyProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {header && <div className="flex-shrink-0">{header}</div>}
      <div className={`flex-1 min-h-0 overflow-y-auto ${bodyPadding}`}>
        {children}
      </div>
      {footer && <div className="flex-shrink-0">{footer}</div>}
    </div>
  );
}
