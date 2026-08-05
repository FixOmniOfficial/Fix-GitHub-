import { useUser } from '@clerk/react';

export type AppRole = 'admin' | 'technician' | 'viewer' | 'user';

export function useRole(): { role: AppRole; isAdmin: boolean; isLoaded: boolean } {
  const { user, isLoaded } = useUser();
  const role = ((user?.publicMetadata as any)?.role as AppRole) ?? 'user';
  return { role, isAdmin: role === 'admin', isLoaded };
}
