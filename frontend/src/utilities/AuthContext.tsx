"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  const mapMeToUser = (data: unknown): User => {
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid /me response (not an object)");
    }

    const d = data as Record<string, unknown>;

    const { id, first_name, last_name, email } = d;

    if (
      typeof id !== "number" ||
      typeof first_name !== "string" ||
      typeof last_name !== "string" ||
      typeof email !== "string"
    ) {
      throw new Error("Invalid /me response shape");
    }

    return {
      id,
      firstName: first_name,
      lastName: last_name,
      email,
    };
  };

  const login = async (email: string, password: string) => {
    const { data } = await axios.post(`${API_URL}/login`, { email, password });

    // 1) Save tokens
    localStorage.setItem("accessToken", data.access_token);
    localStorage.setItem("refreshToken", data.refresh_token);

    // 2) Set Authorization header for future requests
    axios.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;

    // 3) Fetch user via /me
    const meRes = await axios.get(`${API_URL}/me`);
    const me = meRes.data;

    setUser(mapMeToUser(me));

    router.push("/dashboard");
  };

  const register = async (firstName: string, lastName: string, email: string, password: string) => {
    await axios.post(`${API_URL}/register`, {
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
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
    router.push("/");
  }, [router]);

  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem("accessToken");

      if (!accessToken) {
        setLoading(false);
        return;
      }

      axios.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      try {
        const meRes = await axios.get(`${API_URL}/me`);
        setUser(mapMeToUser(meRes.data));
      } catch (err) {
        console.error("Initial /me failed, logging out. Error:", err);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
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
