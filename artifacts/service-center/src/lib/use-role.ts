import { useUser } from '@clerk/react';

export type AppRole = 'super_admin' | 'admin' | 'staff' | 'sub_admin' | 'technician' | 'viewer' | 'user';
export type StaffPermission = 'booking_management' | 'user_management' | 'analytics';

export function useRole(): {
  role: AppRole;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isLoaded: boolean;
  permissions: StaffPermission[];
  hasPermission: (perm: StaffPermission) => boolean;
} {
  const { user, isLoaded } = useUser();
  const role = ((user?.publicMetadata as any)?.role as AppRole) ?? 'user';
  const permissions: StaffPermission[] = ((user?.publicMetadata as any)?.permissions as StaffPermission[]) ?? [];

  const isSuperAdmin = role === 'super_admin';
  const isAdmin      = role === 'admin' || role === 'super_admin';
  const isStaff      = role === 'staff' || role === 'sub_admin';

  function hasPermission(perm: StaffPermission): boolean {
    if (isAdmin) return true;     // admins bypass all permission checks
    return permissions.includes(perm);
  }

  return { role, isSuperAdmin, isAdmin, isStaff, isLoaded, permissions, hasPermission };
}
