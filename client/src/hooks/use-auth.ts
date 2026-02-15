import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SafeUser, Permissions } from "@shared/schema";

type AuthUser = SafeUser & { companyId?: number; needsOnboarding?: boolean; permissions?: Permissions; tradeSlug?: string | null; isSupportAdmin?: boolean };

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    staleTime: Infinity,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json() as Promise<AuthUser>;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/me"], user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
    },
  });

  const perms = user?.permissions;

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    needsOnboarding: !!user?.needsOnboarding,
    isAdmin: user?.role === "ADMIN",
    isOwner: user?.role === "OWNER",
    isSupport: user?.role === "SUPPORT",
    isAdminOrOwner: user?.role === "ADMIN" || user?.role === "OWNER",
    isSupportAdmin: !!user?.isSupportAdmin,
    canViewPrices: perms?.canViewPrices ?? false,
    canEditPrices: perms?.canEditPrices ?? false,
    permissions: perms,
    tradeSlug: user?.tradeSlug || null,
    login: loginMutation,
    logout: logoutMutation,
  };
}
