import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface WishlistState {
  ids: string[];
}

const STORAGE_KEY = 'ph_wishlist';

const loadIds = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

const initialState: WishlistState = { ids: loadIds() };

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    toggle: (state, action: PayloadAction<string>) => {
      const index = state.ids.indexOf(action.payload);
      if (index >= 0) {
        state.ids.splice(index, 1);
      } else {
        state.ids.push(action.payload);
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.ids));
      } catch {
        // storage unavailable
      }
    },
    setWishlist: (state, action: PayloadAction<string[]>) => {
      state.ids = action.payload;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.ids));
      } catch {
        // storage unavailable
      }
    },
    clearWishlist: (state) => {
      state.ids = [];
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // storage unavailable
      }
    },
  },
});

export const { toggle, setWishlist, clearWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
