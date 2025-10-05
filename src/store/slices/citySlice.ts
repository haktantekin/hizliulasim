import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CityState {
  name: string;
  isLoading: boolean;
}

const initialState: CityState = {
  name: 'İstanbul',
  isLoading: true,
};

export const citySlice = createSlice({
  name: 'city',
  initialState,
  reducers: {
    setCity: (state, action: PayloadAction<string>) => {
      state.name = action.payload || 'İstanbul';
      state.isLoading = false;
    },
    setCityLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    resetCity: (state) => {
      state.name = 'İstanbul';
      state.isLoading = false;
    },
  },
});

export const { setCity, setCityLoading, resetCity } = citySlice.actions;

export default citySlice.reducer;
