/**
 * The IAP-authenticated reviewer, from review-serving's `/whoami` endpoint (IAP injects the email header;
 * the endpoint echoes it). Same-origin behind IAP — no token needed. Returns null email outside IAP
 * (e.g. a public/preview build where `/whoami` 404s), so the review UI simply stays hidden there.
 */
import { useQuery } from '@tanstack/react-query';

export type Whoami = { email: string; user: string };

export function useWhoami() {
  const { data } = useQuery({
    queryKey: ['whoami'],
    queryFn: async (): Promise<Whoami | null> => {
      const res = await fetch('/whoami');
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    staleTime: Infinity,
  });
  return { email: data?.email ?? null, user: data?.user ?? null };
}
