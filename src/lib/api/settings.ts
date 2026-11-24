import { api } from "./client";

export interface UserProfile {
    firstName: string;
    lastName: string;
    email: string;
    company: string;
    timezone?: string;
    signature?: string;
}

export interface NotificationPreferences {
    emailSent: boolean;
    emailOpened: boolean;
    emailFailed: boolean;
    weeklyDigest: boolean;
}

export interface SmtpSettings {
    host: string;
    port: number;
    username: string;
    password?: string;
    useTls: boolean;
    fromName: string;
    fromEmail: string;
}

export interface AppearanceSettings {
    theme: "light" | "dark" | "system";
    compactMode: boolean;
    reduceAnimations: boolean;
}

export interface AllSettings {
    profile: UserProfile;
    notifications: NotificationPreferences;
    smtp: SmtpSettings;
    appearance: AppearanceSettings;
}

export const settingsApi = {
    get: () => api.get<AllSettings>("/settings"),
    updateProfile: (data: Partial<UserProfile>) =>
        api.patch<UserProfile>("/settings/profile", data),
    updateNotifications: (data: Partial<NotificationPreferences>) =>
        api.patch<NotificationPreferences>("/settings/notifications", data),
    updateSmtp: (data: Partial<SmtpSettings>) =>
        api.patch<SmtpSettings>("/settings/smtp", data),
    testSmtp: (data: SmtpSettings) =>
        api.post<{ success: boolean; message: string }>("/settings/smtp/test", data),
    updateAppearance: (data: Partial<AppearanceSettings>) =>
        api.patch<AppearanceSettings>("/settings/appearance", data),
    updatePassword: (data: { currentPassword: string; newPassword: string }) =>
        api.post<void>("/auth/change-password", data),
    toggleTwoFactor: (enabled: boolean) =>
        api.post<{ qrCode?: string; backupCodes?: string[] }>("/auth/2fa", { enabled }),
};
