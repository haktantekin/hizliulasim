import { configureStore } from '@reduxjs/toolkit';
import cityReducer from './slices/citySlice';
import locationReducer from './slices/locationSlice';
import userReducer from './slices/userSlice';

export const store = configureStore({
	reducer: {
		city: cityReducer,
		location: locationReducer,
		user: userReducer,
	},
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;