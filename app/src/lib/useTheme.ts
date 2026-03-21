"use client";

import { useState, useEffect, useCallback } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "solwork-theme";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      setThemeState(stored);
    }
    setHydrated(true);
  }, []);

  // Apply theme class to html element
  useEffect(() => {
    if (!hydrated) return;
    const html = document.documentElement;
    if (theme === "light") {
      html.classList.add("light-theme");
      html.classList.remove("dark-theme");
    } else {
      html.classList.add("dark-theme");
      html.classList.remove("light-theme");
    }
  }, [theme, hydrated]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle, hydrated };
}
