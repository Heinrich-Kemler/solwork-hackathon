"use client";

import { useState, useEffect, useCallback } from "react";

export type ViewMode = "hiring" | "working";

const STORAGE_KEY = "solwork-view-mode";

export function useViewMode() {
  const [mode, setModeState] = useState<ViewMode>("hiring");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "hiring" || stored === "working") {
      setModeState(stored);
    }
    setHydrated(true);
  }, []);

  const setMode = useCallback((newMode: ViewMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  return { mode, setMode, hydrated };
}
