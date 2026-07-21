"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "option-chain-theme";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "light", toggle: () => undefined });

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR + first paint stay "light"; inline layout script applies stored theme before paint.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const fromDom = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial: Theme =
      stored === "dark" || stored === "light" ? stored : fromDom;
    setTheme(initial);
    applyTheme(initial);
    if (stored !== "dark" && stored !== "light") {
      window.localStorage.setItem(STORAGE_KEY, initial);
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      applyTheme(next);
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
