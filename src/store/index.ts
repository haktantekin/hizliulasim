import { configureStore } from '@reduxjs/toolkit';
import cityReducer from './slices/citySlice';
import locationReducer from './slices/locationSlice';

export const store = configureStore({
	reducer: {
		city: cityReducer,
		location: locationReducer,
	},
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;