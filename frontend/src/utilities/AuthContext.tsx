"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

import axiosInstance from "./AxiosInstance";

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
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const extractApiMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const clearClientAuth = () => {
  if (typeof window === "undefined") return;

  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  delete axiosInstance.defaults.headers.common["Authorization"];
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  const mapMeToUser = (data: unknown): User => {
    if (typeof data !== "object" || data === null) {
      throw new Error("Server vrátil neplatné údaje o používateľovi.");
    }

    const d = data as Record<string, unknown>;
    const { id, first_name, last_name, email } = d;

    if (typeof id !== "number" || typeof first_name !== "string" || typeof last_name !== "string" || typeof email !== "string") {
      throw new Error("Server vrátil neplatný formát údajov používateľa.");
    }

    return {
      id,
      firstName: first_name,
      lastName: last_name,
      email,
    };
  };

  const login = async (email: string, password: string) => {
    try {
      const { data } = await axiosInstance.post("/login", { email, password });

      const accessToken = data?.access_token;
      const refreshToken = data?.refresh_token;

      if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
        throw new Error("Server vrátil neplatnú odpoveď pri prihlasovaní.");
      }

      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      const meRes = await axiosInstance.get("/me");
      setUser(mapMeToUser(meRes.data));

      router.push("/dashboard");
    } catch (error: unknown) {
      throw new Error(extractApiMessage(error, "Prihlásenie zlyhalo. Skúste znova."));
    }
  };

  const register = async (firstName: string, lastName: string, email: string, password: string) => {
    try {
      await axiosInstance.post("/register", {
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      });

      router.push("/");
    } catch (error: unknown) {
      throw new Error(extractApiMessage(error, "Registrácia zlyhala. Skúste znova."));
    }
  };

  const logout = useCallback(async () => {
    try {
      await axiosInstance.post("/logout");
    } catch (error) {
      console.error("Volanie odhlásenia zlyhalo, lokálne údaje sa aj tak vymažú.", error);
    } finally {
      clearClientAuth();
      setUser(null);
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem("accessToken");

      if (!accessToken) {
        setLoading(false);
        return;
      }

      axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      try {
        const meRes = await axiosInstance.get("/me");
        setUser(mapMeToUser(meRes.data));
      } catch (error) {
        console.error("Načítanie používateľa zlyhalo, lokálne prihlásenie sa vymaže.", error);
        clearClientAuth();
        setUser(null);
        router.replace("/");
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [router]);

  return <AuthContext.Provider value={{ user, login, register, logout, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth musí byť použitý v rámci AuthProvider.");
  }

  return context;
};
