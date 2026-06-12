/**
 * Shared form input primitives.
 *
 * `<Input>` — standardized text input (any HTML input type, not just text).
 * `<Textarea>` — standardized textarea.
 *
 * Replaces the ~24 hand-rolled
 *   `className="w-full px-4 py-2 rounded-lg border-2 border-clay-300
 *    dark:border-earth-600 bg-white dark:bg-earth-700 ..."`
 * incantations scattered across the upload form, settings, signup, login,
 * piece create, etc.
 *
 * `tone` picks the focus ring color:
 *   - `sage` (default) — matches `<SearchInput>` and most pages.
 *   - `terracotta` — used by the upload form and a couple of others where
 *     terracotta was the chosen accent.
 *
 * `size` is `md` (8px Y-padding) by default; `sm` is for compact rows.
 */

import {
  forwardRef,
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

type FocusTone = "sage" | "terracotta";
type Size = "sm" | "md";

const BASE =
  "w-full rounded-lg border-2 bg-white dark:bg-earth-700 text-clay-800 dark:text-clay-200 placeholder-clay-400 dark:placeholder-clay-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const TONE_CLASSES: Record<FocusTone, string> = {
  sage: "border-clay-300 dark:border-earth-600 focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-400",
  terracotta:
    "border-clay-300 dark:border-earth-600 focus:outline-none focus:ring-2 focus:ring-terracotta-500/50 focus:border-terracotta-400",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

// `autoFocus` on iOS Safari scrolls the document to bring the input into
// view — which inside a modal/sheet drags the page underneath. We swap
// the native attribute for an effect that calls `focus({ preventScroll:
// true })` so the input gets focus without the viewport jumping. The
// caller still uses `autoFocus` on the JSX; we intercept it here.
function useAutoFocusNoScroll(
  ref: React.RefObject<HTMLElement>,
  enabled: boolean | undefined,
) {
  useEffect(() => {
    if (!enabled) return;
    // Defer one frame so the modal/sheet has settled into its open state
    // before we steal focus — otherwise iOS sometimes still scrolls.
    const id = requestAnimationFrame(() => {
      ref.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  tone?: FocusTone;
  inputSize?: Size;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ tone = "sage", inputSize = "md", className = "", type = "text", autoFocus, ...props }, ref) => {
    const innerRef = useRef<HTMLInputElement | null>(null);
    useAutoFocusNoScroll(innerRef, autoFocus);
    return (
      <input
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
        }}
        type={type}
        className={`${BASE} ${TONE_CLASSES[tone]} ${SIZE_CLASSES[inputSize]} ${className}`.trim()}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  tone?: FocusTone;
  inputSize?: Size;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ tone = "sage", inputSize = "md", className = "", autoFocus, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    useAutoFocusNoScroll(innerRef, autoFocus);
    return (
      <textarea
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
        }}
        className={`${BASE} resize-none ${TONE_CLASSES[tone]} ${SIZE_CLASSES[inputSize]} ${className}`.trim()}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
