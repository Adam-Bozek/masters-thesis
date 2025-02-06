import axios from "axios";

// Create Axios Instance
const axiosInstance = axios.create({
	baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// Request Interceptor - Attach Access Token
axiosInstance.interceptors.request.use(
	async (config) => {
		const token = localStorage.getItem("accessToken");

		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}

		return config;
	},
	(error) => Promise.reject(error),
);

// Response Interceptor - Handle Token Expiration
axiosInstance.interceptors.response.use(
	async (response) => response,
	async (error) => {
		const originalRequest = error.config;

		if (error.response.status === 401 && !originalRequest._retry) {
			originalRequest._retry = true;

			try {
				const refreshToken = localStorage.getItem("refreshToken");
				if (!refreshToken) throw new Error("No refresh token found.");

				const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/refresh`, {
					refresh_token: refreshToken,
				});

				localStorage.setItem("accessToken", res.data.access_token);

				originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
				return axiosInstance(originalRequest);
			} catch {
				console.error("Session expired, logging out.");
				localStorage.removeItem("accessToken");
				localStorage.removeItem("refreshToken");
				window.location.href = "/login";
			}
		}

		return Promise.reject(error);
	},
);

export default axiosInstance;
