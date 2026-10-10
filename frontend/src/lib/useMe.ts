import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { UserOut } from "@/lib/types";

// Who am I? null (no error thrown) means the visitor is not authenticated.
export function useMe() {
  return useQuery<UserOut | null>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        return await apiGet<UserOut>("/auth/me");
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 30_000,
  });
}
