import { createContext, useContext, useState } from "react";

const AuthContext = createContext();

const users = [
  {
    id: 1,
    name: "Administrator",
    role: "admin",
    username: "admin",
    password: "1234",
  },
  {
    id: 2,
    name: "Sotuvchi 1",
    role: "cashier",
    username: "sotuvchi1",
    password: "1111",
  },
  {
    id: 3,
    name: "Sotuvchi 2",
    role: "cashier",
    username: "sotuvchi2",
    password: "2222",
  },
];

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem("techpro_user");

    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = (username, password) => {
    const foundUser = users.find(
      (user) => user.username === username && user.password === password,
    );

    if (!foundUser) {
      return {
        success: false,
        message: "Login yoki parol noto‘g‘ri",
      };
    }

    localStorage.setItem("techpro_user", JSON.stringify(foundUser));

    setCurrentUser(foundUser);

    return {
      success: true,
      user: foundUser,
    };
  };

  const logout = () => {
    localStorage.removeItem("techpro_user");

    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
