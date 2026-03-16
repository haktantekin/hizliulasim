import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AuthUser, UserFavorites, UserPreferences } from '../../services/auth';

interface UserState {
  user: AuthUser | null;
  favorites: UserFavorites;
  preferences: UserPreferences;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const initialState: UserState = {
  user: null,
  favorites: { stops: [], routes: [], places: [] },
  preferences: {},
  isAuthenticated: false,
  isLoading: true,
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<{ user: AuthUser; favorites?: UserFavorites; preferences?: UserPreferences }>) => {
      // Mevcut avatar_url'yi koru — API'den boş gelirse eski değeri kullan
      const existingAvatar = state.user?.avatar_url;
      state.user = action.payload.user;
      if (!state.user.avatar_url && existingAvatar) {
        state.user.avatar_url = existingAvatar;
      }
      state.isAuthenticated = true;
      state.isLoading = false;
      if (action.payload.favorites) {
        state.favorites = action.payload.favorites;
      }
      if (action.payload.preferences) {
        state.preferences = action.payload.preferences;
      }
    },
    setFavorites: (state, action: PayloadAction<UserFavorites>) => {
      state.favorites = action.payload;
    },
    setPreferences: (state, action: PayloadAction<UserPreferences>) => {
      state.preferences = action.payload;
    },
    setUserLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setAvatar: (state, action: PayloadAction<string>) => {
      if (state.user) {
        state.user.avatar_url = action.payload;
      }
    },
    logout: (state) => {
      state.user = null;
      state.favorites = { stops: [], routes: [], places: [] };
      state.preferences = {};
      state.isAuthenticated = false;
      state.isLoading = false;
    },
  },
});

export const { setUser, setFavorites, setPreferences, setUserLoading, setAvatar, logout } = userSlice.actions;

export default userSlice.reducer;
