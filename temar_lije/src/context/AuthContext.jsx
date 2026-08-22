import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../lib/api';

const AuthContext = createContext(null);

const USER_STORAGE_KEY = 'temar_user';
const TOKEN_STORAGE_KEY = 'temar_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {
        return null;
      }
    }
    return null;
  });

  const [accessToken, setAccessToken] = useState(() => {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || null;
  });

  const [isLoading, setIsLoading] = useState(true);

  // Helper to persist auth state
  const handleAuthSuccess = useCallback((result) => {
    if (result?.user) {
      setUser(result.user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.user));
    }
    if (result?.accessToken) {
      setAccessToken(result.accessToken);
      localStorage.setItem(TOKEN_STORAGE_KEY, result.accessToken);
    }
  }, []);

  // Try silent refresh on initial mount if refreshToken cookie might exist or returning from OAuth
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const hasStoredToken = !!localStorage.getItem(TOKEN_STORAGE_KEY);
      const isOauthCallback = window.location.pathname.includes('/oauth/callback');

      // Only invoke refresh if user previously had a session or returning from OAuth redirect
      if (hasStoredToken || isOauthCallback) {
        try {
          const result = await authApi.refresh();
          if (isMounted && result) {
            handleAuthSuccess(result);
          }
        } catch (_) {
          if (isMounted) {
            setUser(null);
            setAccessToken(null);
            localStorage.removeItem(USER_STORAGE_KEY);
            localStorage.removeItem(TOKEN_STORAGE_KEY);
          }
        }
      }

      if (isMounted) {
        setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [handleAuthSuccess]);

  const login = useCallback(async ({ email, password }) => {
    const result = await authApi.login({ email, password });
    handleAuthSuccess(result);
    return result;
  }, [handleAuthSuccess]);

  const register = useCallback(async ({ fullName, email, password, role, classroomCode, autoLogin = false }) => {
    const result = await authApi.register({ fullName, email, password, role, classroomCode });
    if (autoLogin) {
      handleAuthSuccess(result);
    }
    return result;
  }, [handleAuthSuccess]);

  const logout = useCallback(async () => {
    try {
      if (accessToken) {
        await authApi.logout(accessToken);
      }
    } catch (_) {
      // Proceed with local cleanup even if API call fails
    } finally {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, [accessToken]);

  const verifyEmail = useCallback(async ({ token }) => {
    return authApi.verifyEmail({ token });
  }, []);

  const resendVerification = useCallback(async ({ email }) => {
    return authApi.resendVerification({ email });
  }, []);

  const forgotPassword = useCallback(async ({ email }) => {
    return authApi.forgotPassword({ email });
  }, []);

  const resetPassword = useCallback(async ({ token, newPassword }) => {
    const result = await authApi.resetPassword({ token, newPassword });
    handleAuthSuccess(result);
    return result;
  }, [handleAuthSuccess]);

  const refreshAccessToken = useCallback(async () => {
    const result = await authApi.refresh();
    handleAuthSuccess(result);
    return result?.accessToken || null;
  }, [handleAuthSuccess]);

  const value = {
    user,
    accessToken,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    login,
    register,
    logout,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    refreshAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
