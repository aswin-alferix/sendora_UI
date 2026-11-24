const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

type RequestOptions = {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {} } = options;

    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (res.status === 401) {
        if (typeof window !== "undefined") {
            localStorage.removeItem("auth_token");
            window.location.href = "/login";
        }
        throw new Error("Unauthorized");
    }

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(error.message ?? "Request failed");
    }

    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
}

export const api = {
    get: <T>(path: string, headers?: Record<string, string>) =>
        request<T>(path, { method: "GET", headers }),
    post: <T>(path: string, body: unknown) =>
        request<T>(path, { method: "POST", body }),
    put: <T>(path: string, body: unknown) =>
        request<T>(path, { method: "PUT", body }),
    patch: <T>(path: string, body: unknown) =>
        request<T>(path, { method: "PATCH", body }),
    delete: <T>(path: string) =>
        request<T>(path, { method: "DELETE" }),
};
