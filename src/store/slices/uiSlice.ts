import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ThemeMode = 'dark' | 'light';

interface UiState {
  theme: ThemeMode;
  cartOpen: boolean;
  mobileOpen: boolean;
  searchOpen: boolean;
}

const loadTheme = (): ThemeMode => {
  try {
    return (localStorage.getItem('ph_theme') as ThemeMode) ?? 'dark';
  } catch {
    return 'dark';
  }
};

const initialState: UiState = {
  theme: loadTheme(),
  cartOpen: false,
  mobileOpen: false,
  searchOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<ThemeMode>) => {
      state.theme = action.payload;
      try {
        localStorage.setItem('ph_theme', action.payload);
      } catch {
        // storage unavailable
      }
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('ph_theme', state.theme);
      } catch {
        // storage unavailable
      }
    },
    setCartOpen: (state, action: PayloadAction<boolean>) => {
      state.cartOpen = action.payload;
    },
    setMobileOpen: (state, action: PayloadAction<boolean>) => {
      state.mobileOpen = action.payload;
    },
    setSearchOpen: (state, action: PayloadAction<boolean>) => {
      state.searchOpen = action.payload;
    },
  },
});

export const { setTheme, toggleTheme, setCartOpen, setMobileOpen, setSearchOpen } = uiSlice.actions;
export default uiSlice.reducer;
