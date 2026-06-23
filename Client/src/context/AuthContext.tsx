import React, { createContext, useEffect, useState } from 'react';

const storage = (() => {
  try {
    const { MMKV } = require('react-native-mmkv');
    return new MMKV({ id: 'auth' });
  } catch (error) {
    console.warn('MMKV storage unavailable, falling back to in-memory auth state.');
    return null;
  }
})();

const TOKEN_KEY = 'user_token';

type AuthContextType = {
  token: string | null;
  setToken: (token: string | null) => void;
};

export const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedToken = storage?.getString(TOKEN_KEY) ?? null;
      if (savedToken) {
        setTokenState(savedToken);
      }
    } catch (error) {
      console.warn('Failed to read auth token from MMKV:', error);
    }
  }, []);

  const setToken = (newToken: string | null) => {
    try {
      if (storage) {
        if (newToken) {
          storage.set(TOKEN_KEY, newToken);
        } else {
          storage.delete(TOKEN_KEY);
        }
      }
    } catch (error) {
      console.warn('Failed to persist auth token to MMKV:', error);
    }

    setTokenState(newToken);
  };

  return (
    <AuthContext.Provider value={{ token, setToken }}>
      {children}
    </AuthContext.Provider>
  );
}
