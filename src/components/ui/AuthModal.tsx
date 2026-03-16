'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mail, Lock, User, AtSign, Loader2, Check, AlertCircle } from 'lucide-react';
import { useLogin, useRegister } from '../../hooks/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'register';
}

type Tab = 'login' | 'register';

const AuthModal = ({ isOpen, onClose, defaultTab = 'login' }: AuthModalProps) => {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [error, setError] = useState('');
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkUsername = useCallback(async (value: string) => {
    if (!value || value.length < 3 || !/^[a-z0-9.]{3,30}$/.test(value)) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    try {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(value)}`);
      const data = await res.json();
      setUsernameStatus(data.available ? 'available' : 'taken');
    } catch {
      setUsernameStatus('idle');
    }
  }, []);

  const handleUsernameChange = (value: string) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9.]/g, '');
    setUsername(clean);
    setUsernameStatus('idle');
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    if (clean.length >= 3) {
      usernameTimerRef.current = setTimeout(() => checkUsername(clean), 500);
    }
  };

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  useEffect(() => {
    if (isOpen) setTab(defaultTab);
  }, [isOpen, defaultTab]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setUsername('');
    setUsernameStatus('idle');
    setError('');
  };

  const switchTab = (newTab: Tab) => {
    setTab(newTab);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (tab === 'login') {
      loginMutation.mutate(
        { email, password },
        {
          onSuccess: () => {
            resetForm();
            onClose();
          },
          onError: (err) => setError(err.message),
        }
      );
    } else {
      if (!name.trim()) {
        setError('Ad Soyad gerekli');
        return;
      }
      if (!username || !/^[a-z0-9.]{3,30}$/.test(username)) {
        setError('Kullanıcı adı 3-30 karakter, sadece küçük harf, rakam ve nokta');
        return;
      }
      if (usernameStatus === 'taken') {
        setError('Bu kullanıcı adı zaten kullanılıyor');
        return;
      }
      registerMutation.mutate(
        { email, password, name, username },
        {
          onSuccess: () => {
            resetForm();
            onClose();
          },
          onError: (err) => setError(err.message),
        }
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10001 }}
      className="flex items-center justify-center p-4"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-brand-soft-blue">
            {tab === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Kapat"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => switchTab('login')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === 'login'
                ? 'text-brand-orange border-b-2 border-brand-orange'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Giriş Yap
          </button>
          <button
            onClick={() => switchTab('register')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === 'register'
                ? 'text-brand-orange border-b-2 border-brand-orange'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Kayıt Ol
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {tab === 'register' && (
            <div>
              <label htmlFor="auth-name" className="block text-sm font-medium text-gray-700 mb-1">
                Ad Soyad
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Adınız Soyadınız"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange transition-colors"
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          {tab === 'register' && (
            <div>
              <label htmlFor="auth-username" className="block text-sm font-medium text-gray-700 mb-1">
                Kullanıcı Adı
              </label>
              <div className="relative">
                <AtSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="auth-username"
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="kullanici.adi"
                  className={`w-full pl-10 pr-10 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${
                    usernameStatus === 'taken'
                      ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
                      : usernameStatus === 'available'
                      ? 'border-green-300 focus:ring-green-200 focus:border-green-400'
                      : 'border-gray-200 focus:ring-brand-orange/30 focus:border-brand-orange'
                  }`}
                  autoComplete="username"
                  maxLength={30}
                />
                {usernameStatus === 'checking' && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                )}
                {usernameStatus === 'available' && (
                  <Check size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                )}
                {usernameStatus === 'taken' && (
                  <AlertCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" />
                )}
              </div>
              {username && username.length < 3 && (
                <p className="text-xs text-amber-600 mt-1">En az 3 karakter gerekli</p>
              )}
              {usernameStatus === 'taken' && (
                <p className="text-xs text-red-600 mt-1">Bu kullanıcı adı zaten kullanılıyor</p>
              )}
              {usernameStatus === 'available' && (
                <p className="text-xs text-green-600 mt-1">Kullanıcı adı uygun</p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium text-gray-700 mb-1">
              E-posta
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange transition-colors"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium text-gray-700 mb-1">
              Şifre
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === 'register' ? 'En az 8 karakter' : 'Şifreniz'}
                required
                minLength={tab === 'register' ? 8 : undefined}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange transition-colors"
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-brand-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{tab === 'login' ? 'Giriş yapılıyor...' : 'Kayıt oluşturuluyor...'}</span>
              </>
            ) : (
              <span>{tab === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
