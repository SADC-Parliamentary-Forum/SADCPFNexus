"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AuthContext } from "@/lib/auth";
import { queryIdentityKey, shouldClearQueryCache } from "@/lib/queryIdentity";

export function QueryProvider({ children }: { children: ReactNode }) {
  // useState ensures each browser tab gets its own QueryClient instance
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,        // data stays fresh 30 s — avoids refetch on every nav
            gcTime: 5 * 60_000,       // keep unused cache entries for 5 min
            retry: (failureCount, error) => {
              const status = (error as { response?: { status?: number } })?.response?.status;
              if (status && status < 500) return false;
              return failureCount < 1;
            },
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Private data must never outlive the account it was fetched for: drop the
  // whole cache on logout, same-tab account switch or role change.
  const { user } = useContext(AuthContext);
  const identity = queryIdentityKey(user);
  const previousIdentity = useRef<string | null>(null);
  useEffect(() => {
    if (shouldClearQueryCache(previousIdentity.current, identity)) {
      queryClient.cancelQueries();
      queryClient.clear();
    }
    previousIdentity.current = identity;
  }, [identity, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
