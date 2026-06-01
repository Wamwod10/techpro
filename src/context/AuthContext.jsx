import { createContext, useContext, useEffect, useState } from "react";
import { LOCAL_USERS, toSessionUser } from "../config/localUsers";

const AuthContext = createContext();
const USER_STORAGE_KEY = "techpro_user";
const allowedLocalStorageKeys = new Set([USER_STORAGE_KEY, "techpro_theme"]);

const cleanupLegacyLocalStorage = () => {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("techpro_") && !allowedLocalStorageKeys.has(key)) {
      localStorage.removeItem(key);
    }
  });
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    cleanupLegacyLocalStorage();

    try {
      const savedUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY));
      setCurrentUser(savedUser || null);
    } catch {
      localStorage.removeItem(USER_STORAGE_KEY);
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const login = (username, password) => {
    const cleanUsername = username.trim();
    const user = LOCAL_USERS.find(
      (item) => item.username === cleanUsername && item.password === password,
    );

    if (!user) {
      return {
        success: false,
        message: "Login yoki parol noto'g'ri",
      };
    }

    const sessionUser = toSessionUser(user);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(sessionUser));
    setCurrentUser(sessionUser);

    return {
      success: true,
      user: sessionUser,
    };
  };

  const logout = () => {
    localStorage.removeItem(USER_STORAGE_KEY);

    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        authLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
