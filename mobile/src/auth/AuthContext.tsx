import React, { createContext, useContext } from 'react';

interface AuthContextType {
  logout: () => void | Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ logout: () => void | Promise<void>; children: React.ReactNode }> = ({ logout, children }) => (
  <AuthContext.Provider value={{ logout }}>{children}</AuthContext.Provider>
);

/**
 * Logging out has to flip the `isAuthed` state that lives in `AppNavigator` — the "Auth" route
 * only exists in the root stack while that state is false, so a plain `navigation.reset()` from
 * deep inside the authenticated tree can't target it (no navigator owns that route yet). This
 * context exposes the real state setter instead of faking a navigation action.
 */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
