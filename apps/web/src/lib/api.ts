import { deleteCookie, setCookie } from "./cookies";

export const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function apiRequest<T>(path: string, options?: RequestInit, canRefresh = true): Promise<T> {
  const response = await fetch(`${apiUrl}/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });

  if (response.status === 401 && canRefresh && !path.startsWith("/auth/") && !path.startsWith("/invites/")) {
    try {
      await apiRequest("/auth/refresh", { method: "POST" }, false);
      return apiRequest<T>(path, options, false);
    } catch {
      // Ignore refresh errors, allow the original 401 flow to continue
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Something went wrong. Please try again.");
  }
  if (response.status === 204) {
    if (path === "/auth/logout") {
      deleteCookie("veda_access");
      deleteCookie("veda_refresh");
    }
    return undefined as T;
  }
  
  const data = await response.json();
  if (data && typeof data === "object" && "tokens" in data) {
    const tokens = (data as any).tokens;
    if (tokens?.accessToken) setCookie("veda_access", tokens.accessToken, 7);
    if (tokens?.refreshToken) setCookie("veda_refresh", tokens.refreshToken, 30);
  }
  return data as T;
}

export type Session = {
  user: { _id: string; name: string; email: string; avatar?: string };
  workspace: { _id: string; name: string; city: string };
  role: "ADMIN" | "TEACHER";
};
