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
    const refreshed = await fetch(`${apiUrl}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshed.ok) return apiRequest<T>(path, options, false);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Something went wrong. Please try again.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type Session = {
  user: { _id: string; name: string; email: string; avatar?: string };
  workspace: { _id: string; name: string; city: string };
  role: "ADMIN" | "TEACHER";
};
