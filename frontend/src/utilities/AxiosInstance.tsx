import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type PendingRequest = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

const GUEST_TOKEN_KEY = "guestSessionToken";

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

let isRefreshing = false;
let pending: PendingRequest[] = [];

const clearStoredTokens = () => {
  if (typeof window === "undefined") return;

  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
};

const redirectToLogin = () => {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/") {
    window.location.href = "/";
  }
};

const shouldSkipRefresh = (url?: string) => {
  if (!url) return false;

  return ["/login", "/register", "/refresh"].some((path) => url.endsWith(path));
};

const isGuestSessionsRequest = (url?: string) => {
  if (!url) return false;
  return url.includes("/sessions");
};

const resolvePending = (token: string) => {
  pending.forEach(({ resolve }) => resolve(token));
  pending = [];
};

const rejectPending = (error: unknown) => {
  pending.forEach(({ reject }) => reject(error));
  pending = [];
};

axiosInstance.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken");
    const guestToken = localStorage.getItem(GUEST_TOKEN_KEY);

    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (!token && guestToken && isGuestSessionsRequest(config.url) && !config.headers["X-Guest-Token"]) {
      config.headers["X-Guest-Token"] = guestToken;
    }
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const response = error.response;
    const config = error.config as RetryableRequestConfig | undefined;

    if (!response || !config) {
      throw error;
    }

    const usedGuestToken = Boolean(config.headers?.["X-Guest-Token"]);

    if (usedGuestToken) {
      throw error;
    }

    if (response.status !== 401 || config._retry || shouldSkipRefresh(config.url)) {
      throw error;
    }

    const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null;

    if (!refreshToken) {
      clearStoredTokens();
      redirectToLogin();
      throw error;
    }

    config._retry = true;

    if (isRefreshing) {
      const newToken = await new Promise<string>((resolve, reject) => {
        pending.push({ resolve, reject });
      });

      config.headers.Authorization = `Bearer ${newToken}`;
      return axiosInstance(config);
    }

    isRefreshing = true;

    try {
      const { data } = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/refresh`, null, {
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      });

      const newToken = data?.access_token;

      if (typeof newToken !== "string" || !newToken) {
        throw new Error("Server nevrátil nový prístupový token.");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("accessToken", newToken);
      }

      axiosInstance.defaults.headers.common.Authorization = `Bearer ${newToken}`;
      resolvePending(newToken);

      config.headers.Authorization = `Bearer ${newToken}`;
      return axiosInstance(config);
    } catch (refreshError) {
      rejectPending(refreshError);
      clearStoredTokens();
      redirectToLogin();
      throw refreshError;
    } finally {
      isRefreshing = false;
    }
  },
);

export default axiosInstance;
