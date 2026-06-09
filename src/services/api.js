import axios from "axios";

const localApiUrl = "http://localhost:5000/api";
const productionApiUrl = "https://techpro-backend.onrender.com/api";

export const API_TIMEOUT = 30000;
export const LOGIN_TIMEOUT = 20000;
export const BOOTSTRAP_TIMEOUT = 30000;
export const SERVER_WARMING_MESSAGE = "Server uyg'onmoqda, biroz kuting...";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? localApiUrl : productionApiUrl),
  timeout: API_TIMEOUT,
});

export const SELECTED_STORE_STORAGE_KEY = "techpro_selected_store";

const retryDelays = [1000, 2000];

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isRetryableGetError = (error) => {
  const method = String(error.config?.method || "get").toLowerCase();
  const status = error.response?.status;

  if (method !== "get" || error.code === "ERR_CANCELED") {
    return false;
  }

  return (
    error.code === "ECONNABORTED" ||
    error.message === "Network Error" ||
    !error.response ||
    [408, 425, 429, 500, 502, 503, 504].includes(status)
  );
};

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
  async (error) => {
    const config = error.config || {};

    if (
      config.retry !== false &&
      isRetryableGetError(error) &&
      !config.signal?.aborted
    ) {
      const retryCount = config.__retryCount || 0;

      if (retryCount < retryDelays.length) {
        config.__retryCount = retryCount + 1;
        await sleep(retryDelays[retryCount]);

        if (!config.signal?.aborted) {
          return api(config);
        }
      }
    }

    return Promise.reject(error);
  },
);

export const warmupApi = () =>
  api.get("/health", {
    timeout: 5000,
    retry: false,
  });

export default api;
