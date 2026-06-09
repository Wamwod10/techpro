import axios from "axios";

const localApiUrl = "http://localhost:5000/api";
const productionApiUrl = "https://techpro-backend.onrender.com/api";

export const API_TIMEOUT = 15000;

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? localApiUrl : productionApiUrl),
  timeout: API_TIMEOUT,
});

export const SELECTED_STORE_STORAGE_KEY = "techpro_selected_store";

api.interceptors.request.use((config) => {
  const savedUser = localStorage.getItem("techpro_user");

  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);

      if (user?.name) config.headers["x-techpro-user-name"] = user.name;
      if (user?.role) config.headers["x-techpro-user-role"] = user.role;
      if (user?.username) {
        config.headers["x-techpro-username"] = user.username;
      }

      const storeId =
        user?.role === "admin"
          ? localStorage.getItem(SELECTED_STORE_STORAGE_KEY)
          : user?.storeId;

      if (storeId) {
        config.headers["x-techpro-store-id"] = storeId;
      }
    } catch {
      localStorage.removeItem("techpro_user");
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  },
);

export default api;
