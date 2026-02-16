import React, { createContext, useContext, useState, ReactNode } from "react";

export type UserRole = "admin" | "client";

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  balance: number;
  totalEarned: number;
  referralCode: string;
  referredBy: string | null;
  iptvUser: string;
  iptvServer: string;
  iptvApp: string;
  iptvExpiry: string;
  status: "active" | "suspended" | "blocked";
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const MOCK_USERS: Record<string, { password: string; user: User }> = {
  admin: {
    password: "admin123",
    user: {
      id: "1",
      name: "Administrador",
      username: "admin",
      role: "admin",
      balance: 0,
      totalEarned: 0,
      referralCode: "ADMIN",
      referredBy: null,
      iptvUser: "admin",
      iptvServer: "server1.bitz.tv",
      iptvApp: "BitzPlayer",
      iptvExpiry: "2026-12-31",
      status: "active",
      createdAt: "2024-01-01",
    },
  },
  cliente1: {
    password: "123456",
    user: {
      id: "2",
      name: "João Silva",
      username: "cliente1",
      role: "client",
      balance: 45.5,
      totalEarned: 120.0,
      referralCode: "JOAO2024",
      referredBy: null,
      iptvUser: "joao_iptv",
      iptvServer: "server1.bitz.tv",
      iptvApp: "BitzPlayer",
      iptvExpiry: "2026-06-15",
      status: "active",
      createdAt: "2024-03-10",
    },
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("bitz_user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = (username: string, password: string): boolean => {
    const entry = MOCK_USERS[username];
    if (entry && entry.password === password) {
      setUser(entry.user);
      localStorage.setItem("bitz_user", JSON.stringify(entry.user));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("bitz_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
