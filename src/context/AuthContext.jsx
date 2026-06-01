import { createContext, useContext, useEffect, useState } from "react";
import api, { LOGIN_TIMEOUT } from "../services/api";
import { getApiErrorMessage } from "../utils/apiFlow";

const AuthContext = createContext();
const allowedLocalStorageKeys = new Set(["techpro_token", "techpro_theme"]);

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

    const token = localStorage.getItem("techpro_token");

    if (!token) {
      setAuthLoading(false);
      return;
    }

    api
      .get("/auth/me", { timeout: LOGIN_TIMEOUT })
      .then(({ data }) => setCurrentUser(data))
      .catch(() => {
        localStorage.removeItem("techpro_token");
        setCurrentUser(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  const login = async (username, password) => {
    try {
      const { data } = await api.post(
        "/auth/login",
        { username, password },
        { timeout: LOGIN_TIMEOUT },
      );

      localStorage.setItem("techpro_token", data.token);

      setCurrentUser(data.user);

      return {
        success: true,
        user: data.user,
      };
    } catch (error) {
      return {
        success: false,
        message: getApiErrorMessage(error, "Login yoki parol noto'g'ri"),
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("techpro_token");

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
