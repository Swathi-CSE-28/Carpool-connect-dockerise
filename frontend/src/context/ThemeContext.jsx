import { createContext, useState, useEffect, useCallback, useMemo } from 'react';

export const ThemeContext = createContext(null);

// --- Appearance option catalogs (shared with the Settings page UI) ---

export const FONT_SIZES = {
  sm: { label: 'Small', scale: '93.75%' },
  md: { label: 'Medium', scale: '100%' },
  lg: { label: 'Large', scale: '112.5%' },
  xl: { label: 'Extra large', scale: '125%' }
};

export const FONT_FAMILIES = {
  inter: { label: 'Inter', preview: 'Aa', stack: "'Inter', ui-sans-serif, system-ui, sans-serif", googleFont: 'Inter:wght@400;500;600;700' },
  poppins: { label: 'Poppins', preview: 'Aa', stack: "'Poppins', ui-sans-serif, system-ui, sans-serif", googleFont: 'Poppins:wght@400;500;600;700' },
  merriweather: { label: 'Merriweather', preview: 'Aa', stack: "'Merriweather', ui-serif, Georgia, serif", googleFont: 'Merriweather:wght@400;700' },
  jetbrains: { label: 'JetBrains Mono', preview: 'Aa', stack: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace", googleFont: 'JetBrains+Mono:wght@400;600' }
};

export const BACKGROUND_THEMES = {
  default: { label: 'Default', swatch: '#e2e8f0', light: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)', dark: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)' },
  aurora: { label: 'Aurora', swatch: 'linear-gradient(135deg,#c4b5fd,#67e8f9)', light: 'linear-gradient(135deg, #f5f3ff 0%, #ecfeff 50%, #fdf4ff 100%)', dark: 'linear-gradient(135deg, #1e1b4b 0%, #082f49 50%, #2e1065 100%)' },
  sunset: { label: 'Sunset', swatch: 'linear-gradient(135deg,#fdba74,#fb7185)', light: 'linear-gradient(135deg, #fff7ed 0%, #ffe4e6 55%, #fdf2f8 100%)', dark: 'linear-gradient(135deg, #431407 0%, #4c0519 55%, #3b0764 100%)' },
  ocean: { label: 'Ocean', swatch: 'linear-gradient(135deg,#67e8f9,#60a5fa)', light: 'linear-gradient(135deg, #ecfeff 0%, #eff6ff 60%, #f0fdfa 100%)', dark: 'linear-gradient(135deg, #082f49 0%, #0c4a6e 60%, #042f2e 100%)' },
  forest: { label: 'Forest', swatch: 'linear-gradient(135deg,#bef264,#4ade80)', light: 'linear-gradient(135deg, #f0fdf4 0%, #ecfccb 60%, #f7fee7 100%)', dark: 'linear-gradient(135deg, #052e16 0%, #14532d 60%, #1a2e05 100%)' },
  midnight: { label: 'Midnight', swatch: 'linear-gradient(135deg,#334155,#0f172a)', light: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)', dark: 'linear-gradient(135deg, #000000 0%, #0f172a 100%)' }
};

const clampBrightness = (val) => Math.min(130, Math.max(70, val));

function loadGoogleFont(googleFont) {
  if (!googleFont) return;
  const id = 'cc-google-font-link';
  let link = document.getElementById(id);
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  link.href = `https://fonts.googleapis.com/css2?family=${googleFont}&display=swap`;
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('cc_theme') || 'light');
  const [bgTheme, setBgTheme] = useState(() => localStorage.getItem('cc_bg_theme') || 'default');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('cc_font_size') || 'md');
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('cc_font_family') || 'inter');
  const [brightness, setBrightness] = useState(() => clampBrightness(Number(localStorage.getItem('cc_brightness')) || 100));

  // Dark / light mode
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('cc_theme', theme);
  }, [theme]);

  // Dynamic background theme (re-applies whenever the theme or light/dark mode changes)
  useEffect(() => {
    const bg = BACKGROUND_THEMES[bgTheme] || BACKGROUND_THEMES.default;
    document.body.style.backgroundImage = theme === 'dark' ? bg.dark : bg.light;
    document.body.style.backgroundAttachment = 'fixed';
    localStorage.setItem('cc_bg_theme', bgTheme);
  }, [bgTheme, theme]);

  // Font size: scales the root font-size, which cascades through every rem-based
  // Tailwind utility in the app (text-sm, p-4, etc.) automatically.
  useEffect(() => {
    document.documentElement.style.fontSize = (FONT_SIZES[fontSize] || FONT_SIZES.md).scale;
    localStorage.setItem('cc_font_size', fontSize);
  }, [fontSize]);

  // Font style / family
  useEffect(() => {
    const family = FONT_FAMILIES[fontFamily] || FONT_FAMILIES.inter;
    loadGoogleFont(family.googleFont);
    document.documentElement.style.setProperty('--font-sans', family.stack);
    localStorage.setItem('cc_font_family', fontFamily);
  }, [fontFamily]);

  // Brightness: applied as a CSS variable consumed by the `.app-appearance-scope`
  // wrapper (see App.jsx) rather than on <html>/<body> directly, so floating
  // elements like the chatbot/SOS buttons - rendered outside that wrapper -
  // keep working correctly (a CSS filter on an ancestor would otherwise change
  // the containing block for their `position: fixed`).
  useEffect(() => {
    document.documentElement.style.setProperty('--app-brightness', String(brightness / 100));
    localStorage.setItem('cc_brightness', String(brightness));
  }, [brightness]);

  const toggleTheme = useCallback(() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light')), []);
  const updateBrightness = useCallback((val) => setBrightness(clampBrightness(val)), []);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      setTheme,
      bgTheme,
      setBgTheme,
      backgroundThemes: BACKGROUND_THEMES,
      fontSize,
      setFontSize,
      fontSizes: FONT_SIZES,
      fontFamily,
      setFontFamily,
      fontFamilies: FONT_FAMILIES,
      brightness,
      setBrightness: updateBrightness
    }),
    [theme, toggleTheme, bgTheme, fontSize, fontFamily, brightness, updateBrightness]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
