import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { User } from "../types/api";
import * as authApi from "../api/auth";
import { setAccessToken } from "../api/client";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { name: string; email: string; phone?: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // On first load there is no in-memory access token, so try to silently
    // establish a session from the httpOnly refresh cookie, if any.
    authApi
      .refreshSession()
      .then((data) => {
        setAccessToken(data.accessToken);
        setUser(data.user);
      })
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<User> {
    const data = await authApi.login({ email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }

  async function register(input: { name: string; email: string; phone?: string; password: string }): Promise<User> {
    const data = await authApi.registerCustomer(input);
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }

  async function logout(): Promise<void> {
    await authApi.logout().catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
