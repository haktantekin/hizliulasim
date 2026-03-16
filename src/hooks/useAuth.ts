import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch } from '../store/hooks';
import { setUser, setFavorites, setPreferences, logout as logoutAction, setUserLoading } from '../store/slices/userSlice';
import {
  loginUser,
  registerUser,
  getProfile,
  logoutUser,
  updateFavorite,
  updatePreferences as updatePrefs,
  type FavoriteItem,
  type UserPreferences,
} from '../services/auth';

export const useLogin = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginUser(email, password),
    onSuccess: (data) => {
      dispatch(setUser({ user: data.user }));
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};

export const useRegister = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password, name, username }: { email: string; password: string; name: string; username: string }) =>
      registerUser(email, password, name, username),
    onSuccess: (data) => {
      dispatch(setUser({ user: data.user }));
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};

export const useProfile = () => {
  const dispatch = useAppDispatch();

  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const data = await getProfile();
      const user = data.user;

      // avatar_url yoksa profil endpoint'inden çek
      if (!user.avatar_url && user.username) {
        try {
          const profileRes = await fetch(`/api/auth/profile/${encodeURIComponent(user.username)}`, {
            credentials: 'include',
          });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            if (profileData.user?.avatar_url) {
              user.avatar_url = profileData.user.avatar_url;
            }
          }
        } catch { /* ignore */ }
      }

      dispatch(setUser({
        user,
        favorites: data.favorites,
        preferences: data.preferences,
      }));
      return data;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: false,
  });
};

export const useLogout = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      dispatch(logoutAction());
      queryClient.removeQueries({ queryKey: ['profile'] });
    },
  });
};

export const useUpdateFavorite = () => {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: ({ type, action, item }: { type: 'stops' | 'routes' | 'places'; action: 'add' | 'remove'; item: FavoriteItem }) =>
      updateFavorite(type, action, item),
    onSuccess: (data) => {
      dispatch(setFavorites(data));
    },
  });
};

export const useUpdatePreferences = () => {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: (prefs: Partial<UserPreferences>) => updatePrefs(prefs),
    onSuccess: (data) => {
      dispatch(setPreferences(data));
    },
  });
};

export const useInitAuth = () => {
  const dispatch = useAppDispatch();

  const checkAuth = async () => {
    try {
      const data = await getProfile();
      const user = data.user;

      // avatar_url henüz /me'den gelmiyorsa profil endpoint'inden çek
      if (!user.avatar_url && user.username) {
        try {
          const profileRes = await fetch(`/api/auth/profile/${encodeURIComponent(user.username)}`, {
            credentials: 'include',
          });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            if (profileData.user?.avatar_url) {
              user.avatar_url = profileData.user.avatar_url;
            }
          }
        } catch { /* ignore */ }
      }

      dispatch(setUser({
        user,
        favorites: data.favorites,
        preferences: data.preferences,
      }));
    } catch {
      dispatch(setUserLoading(false));
    }
  };

  return checkAuth;
};
