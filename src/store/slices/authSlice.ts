import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthUser } from '@/types';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
}

const TOKEN_KEY = 'ph_token';

const loadToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const loadUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem('ph_user');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

const initialState: AuthState = {
  token: loadToken(),
  user: loadUser(),
  isHydrated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ token: string; user: AuthUser }>) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      try {
        localStorage.setItem(TOKEN_KEY, action.payload.token);
        localStorage.setItem('ph_user', JSON.stringify(action.payload.user));
      } catch {
        // storage unavailable
      }
    },
    setUser: (state, action: PayloadAction<AuthUser>) => {
      state.user = action.payload;
      try {
        localStorage.setItem('ph_user', JSON.stringify(action.payload));
      } catch {
        // storage unavailable
      }
    },
    clearCredentials: (state) => {
      state.token = null;
      state.user = null;
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('ph_user');
      } catch {
        // storage unavailable
      }
    },
    markHydrated: (state) => {
      state.isHydrated = true;
    },
  },
});

export const { setCredentials, setUser, clearCredentials, markHydrated } = authSlice.actions;
export default authSlice.reducer;
