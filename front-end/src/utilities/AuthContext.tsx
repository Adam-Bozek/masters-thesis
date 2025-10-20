"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

interface User {
	id: number;
	firstName: string;
	lastName: string;
	email: string;
	createdAt?: string;
}

interface AuthContextType {
	user: User | null;
	login: (email: string, password: string) => Promise<void>;
	register: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
	logout: () => void;
	loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const router = useRouter();

	const login = async (email: string, password: string) => {
		const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/login`, { email, password });

		localStorage.setItem("accessToken", res.data.access_token);
		localStorage.setItem("refreshToken", res.data.refresh_token);

		setUser({
			id: res.data.user.id,
			firstName: res.data.user.first_name,
			lastName: res.data.user.last_name,
			email: res.data.user.email,
			createdAt: res.data.user.created_at,
		});

		router.push("/dashboard");
	};

	const register = async (firstName: string, lastName: string, email: string, password: string) => {
		await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/register`, {
			first_name: firstName,
			last_name: lastName,
			email,
			password,
		});

		router.push("/"); // Redirect to login after successful registration
	};

	const logout = useCallback(() => {
		localStorage.removeItem("accessToken");
		localStorage.removeItem("refreshToken");
		setUser(null);
		router.push("/");
	}, [router]);

	useEffect(() => {
		const refreshAccessToken = async () => {
			const refreshToken = localStorage.getItem("refreshToken");
			if (!refreshToken) {
				setLoading(false);
				return;
			}

			try {
				const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/refresh`, {
					refresh_token: refreshToken,
				});

				localStorage.setItem("accessToken", res.data.access_token);

				setUser({
					id: res.data.user.id,
					firstName: res.data.user.first_name,
					lastName: res.data.user.last_name,
					email: res.data.user.email,
					createdAt: res.data.user.created_at,
				});
			} catch (err) {
				console.error("Refresh token failed, logging out. Error: " + err);
				logout();
			} finally {
				setLoading(false);
			}
		};

		refreshAccessToken();
	}, [logout]);

	return <AuthContext.Provider value={{ user, login, register, logout, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};
