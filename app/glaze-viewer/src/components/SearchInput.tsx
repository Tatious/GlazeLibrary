/**
 * Search Input Component
 * Reusable search input with search icon and spring focus animation
 */

import { forwardRef, InputHTMLAttributes, useState } from "react";
import { motion } from "framer-motion";
import { springs } from "../config/animations";
import { Search } from "./Icons";

type SearchInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className = "", onFocus, onBlur, onKeyDown, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <motion.div
        className="relative"
        animate={{
          scale: isFocused ? 1.01 : 1,
        }}
        transition={springs.quick}
      >
        <input
          ref={ref}
          type="text"
          {...props}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Blur the input to dismiss touch keyboard
              e.currentTarget.blur();
            }
            onKeyDown?.(e);
          }}
          className={`w-full px-4 py-2 pl-10 rounded-lg border-2 border-clay-300 dark:border-earth-600 bg-white dark:bg-earth-800 text-clay-800 dark:text-clay-200 placeholder-clay-500 dark:placeholder-earth-400 focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-400 transition-shadow duration-150 ${className}`}
        />
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clay-500 dark:text-clay-400 transition-colors"
        />
      </motion.div>
    );
  },
);

SearchInput.displayName = "SearchInput";
