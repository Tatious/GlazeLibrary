/**
 * Button Component Design System
 *
 * Variants:
 * - primary: Main actions (Apply, Save, Add)
 * - secondary: Secondary actions, neutral emphasis
 * - ghost: Minimal styling, text-like buttons (Cancel, Sort options)
 * - chip: Toggle/filter chips with active state
 * - icon: Icon-only buttons with consistent sizing
 * - nav: Navigation tabs/links
 *
 * All variants have consistent hover and active states for better UX.
 */

import { forwardRef, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { springs } from "../config/animations";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "chip"
  | "icon"
  | "nav";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonColor =
  | "default"
  | "moss"
  | "sage"
  | "terracotta"
  | "butter"
  | "danger";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  color?: ButtonColor;
  active?: boolean;
  children?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

// Base styles shared across all variants
const baseStyles =
  "inline-flex items-center justify-center font-medium transition-colors focus-ring rounded-lg disabled:opacity-50 disabled:pointer-events-none";

// Size configurations
const sizeStyles: Record<ButtonVariant, Record<ButtonSize, string>> = {
  primary: {
    sm: "px-3 py-1.5 text-sm gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2",
  },
  secondary: {
    sm: "px-3 py-1.5 text-sm gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2",
  },
  ghost: {
    sm: "px-2 py-1 text-sm gap-1",
    md: "px-3 py-1.5 text-sm gap-1.5",
    lg: "px-4 py-2 text-base gap-2",
  },
  chip: {
    sm: "px-2 py-1 text-xs gap-1 border",
    md: "px-2.5 py-1.5 text-sm gap-1.5 border",
    lg: "px-3 py-2 text-sm gap-2 border",
  },
  icon: {
    sm: "p-1.5",
    md: "p-2",
    lg: "p-2.5",
  },
  nav: {
    sm: "px-2 py-1.5 text-xs gap-1",
    md: "px-3 py-2 text-sm gap-1.5",
    lg: "px-4 py-2.5 text-base gap-2",
  },
};

// Color/variant combinations for inactive state
const variantStyles: Record<
  ButtonVariant,
  Record<ButtonColor, { inactive: string; active: string }>
> = {
  primary: {
    default: {
      inactive:
        "bg-clay-700 text-white hover:bg-clay-800 active:bg-clay-900 dark:bg-clay-200 dark:text-earth-900 dark:hover:bg-clay-100 dark:active:bg-white",
      active: "bg-clay-900 text-white dark:bg-white dark:text-earth-900",
    },
    moss: {
      inactive: "bg-moss-600 text-white hover:bg-moss-700 active:bg-moss-800",
      active: "bg-moss-700 text-white",
    },
    sage: {
      inactive: "bg-sage-600 text-white hover:bg-sage-700 active:bg-sage-800",
      active: "bg-sage-700 text-white",
    },
    terracotta: {
      inactive:
        "bg-terracotta-600 text-white hover:bg-terracotta-700 active:bg-terracotta-800",
      active: "bg-terracotta-700 text-white",
    },
    butter: {
      inactive:
        "bg-butter-500 text-earth-900 hover:bg-butter-600 active:bg-butter-700",
      active: "bg-butter-600 text-earth-900",
    },
    danger: {
      inactive: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
      active: "bg-red-700 text-white",
    },
  },
  secondary: {
    default: {
      inactive:
        "bg-clay-100 text-clay-700 hover:bg-clay-200 active:bg-clay-300 dark:bg-earth-700 dark:text-clay-300 dark:hover:bg-earth-600 dark:active:bg-earth-500",
      active:
        "bg-clay-200 text-clay-800 ring-2 ring-clay-400 dark:bg-earth-600 dark:text-clay-200",
    },
    moss: {
      inactive:
        "bg-moss-100 text-moss-700 hover:bg-moss-200 active:bg-moss-300 dark:bg-moss-900/50 dark:text-moss-300 dark:hover:bg-moss-900 dark:active:bg-moss-800",
      active:
        "bg-moss-200 text-moss-800 ring-2 ring-moss-400 dark:bg-moss-900 dark:text-moss-200",
    },
    sage: {
      inactive:
        "bg-sage-100 text-sage-700 hover:bg-sage-200 active:bg-sage-300 dark:bg-sage-900/50 dark:text-sage-300 dark:hover:bg-sage-900 dark:active:bg-sage-800",
      active:
        "bg-sage-200 text-sage-800 ring-2 ring-sage-400 dark:bg-sage-900 dark:text-sage-200",
    },
    terracotta: {
      inactive:
        "bg-terracotta-100 text-terracotta-700 hover:bg-terracotta-200 active:bg-terracotta-300 dark:bg-terracotta-900/50 dark:text-terracotta-300 dark:hover:bg-terracotta-900 dark:active:bg-terracotta-800",
      active:
        "bg-terracotta-200 text-terracotta-800 ring-2 ring-terracotta-400 dark:bg-terracotta-900 dark:text-terracotta-200",
    },
    butter: {
      inactive:
        "bg-butter-100 text-butter-700 hover:bg-butter-200 active:bg-butter-300 dark:bg-butter-900/50 dark:text-butter-300 dark:hover:bg-butter-900 dark:active:bg-butter-800",
      active:
        "bg-butter-200 text-butter-800 ring-2 ring-butter-400 dark:bg-butter-900 dark:text-butter-200",
    },
    danger: {
      inactive:
        "bg-red-100 text-red-700 hover:bg-red-200 active:bg-red-300 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900 dark:active:bg-red-800",
      active:
        "bg-red-200 text-red-800 ring-2 ring-red-400 dark:bg-red-900 dark:text-red-200",
    },
  },
  ghost: {
    default: {
      inactive:
        "text-clay-700 hover:bg-clay-100 active:bg-clay-200 dark:text-clay-300 dark:hover:bg-earth-700 dark:active:bg-earth-600",
      active: "text-clay-900 bg-clay-100 dark:text-clay-100 dark:bg-earth-700",
    },
    moss: {
      inactive:
        "text-moss-700 hover:bg-moss-100 active:bg-moss-200 dark:text-moss-300 dark:hover:bg-moss-900/50 dark:active:bg-moss-900",
      active:
        "text-moss-800 bg-moss-100 dark:text-moss-200 dark:bg-moss-900/50",
    },
    sage: {
      inactive:
        "text-sage-700 hover:bg-sage-100 active:bg-sage-200 dark:text-sage-300 dark:hover:bg-sage-900/50 dark:active:bg-sage-900",
      active:
        "text-sage-800 bg-sage-100 dark:text-sage-200 dark:bg-sage-900/50",
    },
    terracotta: {
      inactive:
        "text-terracotta-600 hover:bg-terracotta-100 active:bg-terracotta-200 dark:text-terracotta-400 dark:hover:bg-terracotta-900/50 dark:active:bg-terracotta-900",
      active:
        "text-terracotta-700 bg-terracotta-100 dark:text-terracotta-300 dark:bg-terracotta-900/50",
    },
    butter: {
      inactive:
        "text-butter-600 hover:bg-butter-100 active:bg-butter-200 dark:text-butter-400 dark:hover:bg-butter-900/50 dark:active:bg-butter-900",
      active:
        "text-butter-700 bg-butter-100 dark:text-butter-300 dark:bg-butter-900/50",
    },
    danger: {
      inactive:
        "text-red-600 hover:bg-red-100 active:bg-red-200 dark:text-red-400 dark:hover:bg-red-900/50 dark:active:bg-red-900",
      active: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/50",
    },
  },
  chip: {
    default: {
      inactive:
        "bg-clay-100 text-clay-700 border-clay-300 hover:bg-clay-200 hover:border-clay-400 active:bg-clay-300 dark:bg-earth-700 dark:text-clay-300 dark:border-earth-500 dark:hover:bg-earth-600 dark:active:bg-earth-500",
      active:
        "bg-sage-100 text-sage-700 border-sage-400 dark:bg-sage-900 dark:text-sage-300 dark:border-sage-500",
    },
    moss: {
      inactive:
        "bg-clay-100 text-clay-700 border-clay-300 hover:bg-clay-200 hover:border-clay-400 active:bg-clay-300 dark:bg-earth-700 dark:text-clay-300 dark:border-earth-500 dark:hover:bg-earth-600 dark:active:bg-earth-500",
      active:
        "bg-moss-100 text-moss-700 border-moss-400 dark:bg-moss-900 dark:text-moss-300 dark:border-moss-500",
    },
    sage: {
      inactive:
        "bg-clay-100 text-clay-700 border-clay-300 hover:bg-clay-200 hover:border-clay-400 active:bg-clay-300 dark:bg-earth-700 dark:text-clay-300 dark:border-earth-500 dark:hover:bg-earth-600 dark:active:bg-earth-500",
      active:
        "bg-sage-100 text-sage-700 border-sage-400 dark:bg-sage-900 dark:text-sage-300 dark:border-sage-500",
    },
    terracotta: {
      inactive:
        "bg-clay-100 text-clay-700 border-clay-300 hover:bg-clay-200 hover:border-clay-400 active:bg-clay-300 dark:bg-earth-700 dark:text-clay-300 dark:border-earth-500 dark:hover:bg-earth-600 dark:active:bg-earth-500",
      active:
        "bg-terracotta-100 text-terracotta-700 border-terracotta-400 dark:bg-terracotta-900 dark:text-terracotta-300 dark:border-terracotta-500",
    },
    butter: {
      inactive:
        "bg-clay-100 text-clay-700 border-clay-300 hover:bg-clay-200 hover:border-clay-400 active:bg-clay-300 dark:bg-earth-700 dark:text-clay-300 dark:border-earth-500 dark:hover:bg-earth-600 dark:active:bg-earth-500",
      active:
        "bg-butter-100 text-butter-700 border-butter-400 dark:bg-butter-900 dark:text-butter-300 dark:border-butter-500",
    },
    danger: {
      inactive:
        "bg-clay-100 text-clay-700 border-clay-300 hover:bg-clay-200 hover:border-clay-400 active:bg-clay-300 dark:bg-earth-700 dark:text-clay-300 dark:border-earth-500 dark:hover:bg-earth-600 dark:active:bg-earth-500",
      active:
        "bg-red-100 text-red-700 border-red-400 dark:bg-red-900 dark:text-red-300 dark:border-red-500",
    },
  },
  icon: {
    default: {
      inactive:
        "text-clay-500 hover:bg-clay-100 hover:text-clay-700 active:bg-clay-200 dark:text-clay-400 dark:hover:bg-earth-700 dark:hover:text-clay-300 dark:active:bg-earth-600",
      active: "bg-clay-100 text-clay-700 dark:bg-earth-700 dark:text-clay-300",
    },
    moss: {
      inactive:
        "text-clay-400 hover:bg-moss-100 hover:text-moss-600 active:bg-moss-200 dark:hover:bg-moss-900 dark:hover:text-moss-400 dark:active:bg-moss-800",
      active: "bg-moss-100 text-moss-600 dark:bg-moss-900 dark:text-moss-400",
    },
    sage: {
      inactive:
        "text-clay-400 hover:bg-sage-100 hover:text-sage-600 active:bg-sage-200 dark:hover:bg-sage-900 dark:hover:text-sage-400 dark:active:bg-sage-800",
      active: "bg-sage-100 text-sage-600 dark:bg-sage-900 dark:text-sage-400",
    },
    terracotta: {
      inactive:
        "text-clay-400 hover:bg-terracotta-100 hover:text-terracotta-600 active:bg-terracotta-200 dark:hover:bg-terracotta-900 dark:hover:text-terracotta-400 dark:active:bg-terracotta-800",
      active:
        "bg-terracotta-100 text-terracotta-600 dark:bg-terracotta-900 dark:text-terracotta-400",
    },
    butter: {
      inactive:
        "text-clay-400 hover:bg-butter-100 hover:text-butter-600 active:bg-butter-200 dark:hover:bg-butter-900 dark:hover:text-butter-400 dark:active:bg-butter-800",
      active:
        "bg-butter-100 text-butter-600 dark:bg-butter-900 dark:text-butter-400",
    },
    danger: {
      inactive:
        "text-clay-400 hover:bg-red-100 hover:text-red-600 active:bg-red-200 dark:hover:bg-red-900 dark:hover:text-red-400 dark:active:bg-red-800",
      active: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
    },
  },
  nav: {
    default: {
      inactive:
        "text-clay-600 hover:bg-clay-100 active:bg-clay-200 dark:text-clay-400 dark:hover:bg-earth-700 dark:active:bg-earth-600",
      active:
        "bg-terracotta-100 text-terracotta-700 dark:bg-terracotta-900/50 dark:text-terracotta-300",
    },
    moss: {
      inactive:
        "text-clay-600 hover:bg-moss-100 active:bg-moss-200 dark:text-clay-400 dark:hover:bg-moss-900/50 dark:active:bg-moss-900",
      active:
        "bg-moss-100 text-moss-700 dark:bg-moss-900/50 dark:text-moss-300",
    },
    sage: {
      inactive:
        "text-clay-600 hover:bg-sage-100 active:bg-sage-200 dark:text-clay-400 dark:hover:bg-sage-900/50 dark:active:bg-sage-900",
      active:
        "bg-sage-100 text-sage-700 dark:bg-sage-900/50 dark:text-sage-300",
    },
    terracotta: {
      inactive:
        "text-clay-600 hover:bg-clay-100 active:bg-clay-200 dark:text-clay-400 dark:hover:bg-earth-700 dark:active:bg-earth-600",
      active:
        "bg-terracotta-100 text-terracotta-700 dark:bg-terracotta-900/50 dark:text-terracotta-300",
    },
    butter: {
      inactive:
        "text-clay-600 hover:bg-butter-100 active:bg-butter-200 dark:text-clay-400 dark:hover:bg-butter-900/50 dark:active:bg-butter-900",
      active:
        "bg-butter-100 text-butter-700 dark:bg-butter-900/50 dark:text-butter-300",
    },
    danger: {
      inactive:
        "text-clay-600 hover:bg-red-100 active:bg-red-200 dark:text-clay-400 dark:hover:bg-red-900/50 dark:active:bg-red-900",
      active: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    },
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      color = "default",
      active = false,
      children,
      leftIcon,
      rightIcon,
      className = "",
      ...props
    },
    ref,
  ) => {
    const colorStyles = variantStyles[variant][color];
    const stateStyles = active ? colorStyles.active : colorStyles.inactive;

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={springs.quick}
        className={`${baseStyles} ${sizeStyles[variant][size]} ${stateStyles} ${className}`}
        {...props}
      >
        {leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </motion.button>
    );
  },
);

Button.displayName = "Button";

// Convenience component for icon-only buttons
interface IconButtonProps extends Omit<
  ButtonProps,
  "variant" | "leftIcon" | "rightIcon" | "children"
> {
  icon: ReactNode;
  label: string; // Required for accessibility
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, size = "md", ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="icon"
        size={size}
        aria-label={label}
        title={label}
        {...props}
      >
        {icon}
      </Button>
    );
  },
);

IconButton.displayName = "IconButton";
