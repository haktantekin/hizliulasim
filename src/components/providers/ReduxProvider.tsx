'use client';

import { Provider } from 'react-redux';
import { store } from '../../store';
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setDistrict } from '../../store/slices/locationSlice';

function Persistor() {
  const dispatch = useAppDispatch();
  const district = useAppSelector((s) => s.location.district);
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('selectedDistrict') : null;
      if (saved) {
        dispatch(setDistrict(saved));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        if (district) localStorage.setItem('selectedDistrict', district);
        else localStorage.removeItem('selectedDistrict');
      }
    } catch {}
  }, [district]);
  return null;
}

export default function ReduxProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <Persistor />
      {children}
    </Provider>
  );
}
