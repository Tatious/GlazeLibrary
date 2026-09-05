/**
 * Password field with a built-in show/hide eye toggle. Same look as
 * `<Input>` — adds right padding for the icon button.
 */

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "./Icons";

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
  sm: "px-3 py-1.5 pr-9 text-sm",
  md: "px-4 py-2 pr-10 text-sm",
};

interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  tone?: FocusTone;
  inputSize?: Size;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ tone = "sage", inputSize = "md", className = "", ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={`${BASE} ${TONE_CLASSES[tone]} ${SIZE_CLASSES[inputSize]} ${className}`.trim()}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex items-center px-2.5 text-clay-500 dark:text-clay-400 hover:text-clay-700 dark:hover:text-clay-200 transition-colors"
        >
          {visible ? <EyeOff size="sm" /> : <Eye size="sm" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
