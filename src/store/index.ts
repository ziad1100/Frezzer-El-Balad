import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import cartReducer, { type CartState } from './slices/cartSlice';
import wishlistReducer from './slices/wishlistSlice';
import uiReducer from './slices/uiSlice';

const cartPersist = createListenerMiddleware();

cartPersist.startListening({
  predicate: (action) => action.type.startsWith('cart/'),
  effect: (_action, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    try {
      localStorage.setItem('ph_cart', JSON.stringify(state.cart));
    } catch {
      // storage unavailable
    }
  },
});

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    wishlist: wishlistReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(cartPersist.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type { CartState };
