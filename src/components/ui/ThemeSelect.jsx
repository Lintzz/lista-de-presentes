"use client";

import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "meupresente-theme";
export const DEFAULT_THEME = "slate";

export const THEMES = [
  { value: "slate", label: "Escuro" },
  { value: "graphite", label: "Grafite" },
  { value: "light", label: "Claro" },
];

// Roda antes da primeira pintura (injetado no <head> pelo layout) para não
// piscar o tema escuro em quem escolheu o claro.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});document.documentElement.dataset.theme=${JSON.stringify(
  THEMES.map((t) => t.value)
)}.indexOf(t)>-1?t:${JSON.stringify(DEFAULT_THEME)};}catch(e){document.documentElement.dataset.theme=${JSON.stringify(
  DEFAULT_THEME
)};}})();`;

export function ThemeSelect() {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  // O valor real já está no <html> quando hidratamos; só sincronizamos o state.
  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current) setTheme(current);
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setTheme(value);
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch (error) {
      // localStorage bloqueado (aba anônima, por exemplo): o tema vale só nesta sessão.
    }
  };

  return (
    <select
      value={theme}
      onChange={handleChange}
      className="theme-select"
      aria-label="Tema do app"
      title="Tema do app"
    >
      {THEMES.map((t) => (
        <option key={t.value} value={t.value}>{t.label}</option>
      ))}
    </select>
  );
}
