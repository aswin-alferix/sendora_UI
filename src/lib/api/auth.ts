import { api } from "./client";

export interface AuthUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    company?: string;
    avatarUrl?: string;
}

export interface LoginPayload {
    email: string;
    password: string;
}

export interface RegisterPayload {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    company?: string;
}

export interface AuthResponse {
    token: string;
    user: AuthUser;
}

export const authApi = {
    login: (payload: LoginPayload) =>
        api.post<AuthResponse>("/auth/login", payload),
    register: (payload: RegisterPayload) =>
        api.post<AuthResponse>("/auth/register", payload),
    logout: () =>
        api.post<void>("/auth/logout", {}),
    me: () =>
        api.get<AuthUser>("/auth/me"),
    forgotPassword: (email: string) =>
        api.post<void>("/auth/forgot-password", { email }),
    resetPassword: (token: string, password: string) =>
        api.post<void>("/auth/reset-password", { token, password }),
};
