"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-9 h-9" />; // placeholder to avoid layout shift
  }

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 space-x-1 border border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setTheme("light")}
        className={`p-1.5 rounded-md transition-colors ${
          theme === "light"
            ? "bg-white dark:bg-gray-700 shadow-sm text-amber-500"
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
        title="浅色模式"
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`p-1.5 rounded-md transition-colors ${
          theme === "system"
            ? "bg-white dark:bg-gray-700 shadow-sm text-blue-500 dark:text-blue-400"
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
        title="跟随系统"
      >
        <Monitor className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`p-1.5 rounded-md transition-colors ${
          theme === "dark"
            ? "bg-white dark:bg-gray-700 shadow-sm text-indigo-400"
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
        title="深色模式"
      >
        <Moon className="w-4 h-4" />
      </button>
    </div>
  );
}
