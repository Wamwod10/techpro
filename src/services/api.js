import axios from "axios";

const localApiUrl = "http://localhost:5000/api";
const productionApiUrl = "https://techpro-backend.onrender.com/api";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? localApiUrl : productionApiUrl),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("techpro_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("techpro_token");
    }

    return Promise.reject(error);
  },
);

export default api;
