import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface LocationState {
  city: string;
  district: string;
  coordinates: {
    lat: number;
    lon: number;
  } | null;
  isLoading: boolean;
  place: string;
}

const initialState: LocationState = {
  city: 'İstanbul',
  district: 'Beşiktaş',
  coordinates: null,
  isLoading: true,
  place: 'Beşiktaş, İstanbul'
};

export const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setLocation: (state, action: PayloadAction<{
      city: string;
      district: string;
      coordinates?: { lat: number; lon: number };
    }>) => {
      state.city = action.payload.city;
      state.district = action.payload.district;
      state.place = `${action.payload.district}, ${action.payload.city}`;
      if (action.payload.coordinates) {
        state.coordinates = action.payload.coordinates;
      }
      state.isLoading = false;
    },
    setCoordinates: (state, action: PayloadAction<{ lat: number; lon: number }>) => {
      state.coordinates = action.payload;
    },
    setDistrict: (state, action: PayloadAction<string>) => {
      state.district = action.payload;
      state.place = `${action.payload}, ${state.city}`;
      state.isLoading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    resetToDefault: (state) => {
      state.city = 'İstanbul';
      state.district = 'Beşiktaş';
      state.place = 'Beşiktaş, İstanbul';
      state.coordinates = null;
      state.isLoading = false;
    }
  },
});

export const { setDistrict } = locationSlice.actions;

export default locationSlice.reducer;