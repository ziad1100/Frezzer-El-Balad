import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { setTheme, type ThemeMode } from '@/store/slices/uiSlice';

export function useTheme(): { theme: ThemeMode; toggleTheme: () => void; setTheme: (t: ThemeMode) => void } {
  const theme = useAppSelector((state) => state.ui.theme);
  const dispatch = useAppDispatch();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0D0D0D' : '#FAFAFA');
  }, [theme]);

  return {
    theme,
    toggleTheme: () => dispatch({ type: 'ui/toggleTheme' }),
    setTheme: (t) => dispatch(setTheme(t)),
  };
}