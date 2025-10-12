import axios from "axios";

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

axiosInstance.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pending: Array<(t: string) => void> = [];

axiosInstance.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { response, config } = error || {};
    if (!response) throw error;

    if (response.status === 401 && !config._retry) {
      config._retry = true;

      if (isRefreshing) {
        const token = await new Promise<string>((resolve) => pending.push(resolve));
        config.headers.Authorization = `Bearer ${token}`;
        return axiosInstance(config);
      }

      isRefreshing = true;
      try {
        const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null;
        const { data } = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, { refreshToken });
        const newToken = data?.accessToken;
        if (typeof window !== "undefined") localStorage.setItem("accessToken", newToken);
        pending.forEach((fn) => fn(newToken));
        pending = [];
        config.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(config);
      } catch (e) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          window.location.href = "/login";
        }
        throw e;
      } finally {
        isRefreshing = false;
      }
    }

    throw error;
  }
);

export default axiosInstance;
