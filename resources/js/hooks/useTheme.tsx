import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
export type ThemeChoice = 'system' | 'light' | 'dark';
export const themeKey = 'madatours:theme:v1';
const ThemeContext = createContext({
  choice: 'system' as ThemeChoice,
  dark: false,
  setChoice: (_: ThemeChoice) => {},
});
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>(() => {
    try {
      const saved = localStorage.getItem(themeKey);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* System theme still works. */
    }
    return 'system';
  });
  const [systemDark, setSystemDark] = useState(
    () => matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const dark = choice === 'dark' || (choice === 'system' && systemDark);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemDark(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#191714' : '#fdfcfb');
    try {
      localStorage.setItem(themeKey, choice);
    } catch {
      /* Persist for this session only. */
    }
  }, [choice, dark]);
  return (
    <ThemeContext.Provider value={{ choice, dark, setChoice }}>{children}</ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
