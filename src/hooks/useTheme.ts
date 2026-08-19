import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { setTheme, type ThemeMode } from '@/store/slices/uiSlice';

export function useTheme(): { theme: ThemeMode; toggleTheme: () => void; setTheme: (t: ThemeMode) => void } {
  const theme = useAppSelector((state) => state.ui.theme);
  const dispatch = useAppDispatch();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    // Update theme-color meta tag
    const themeColor = theme === 'dark' ? '#0F172A' : '#F8FAFC';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  }, [theme]);

  return {
    theme,
    toggleTheme: () => dispatch({ type: 'ui/toggleTheme' }),
    setTheme: (t) => dispatch(setTheme(t)),
  };
}