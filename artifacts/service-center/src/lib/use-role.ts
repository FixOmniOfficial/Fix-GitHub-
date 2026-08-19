import { useAuthContext } from '@/contexts/AuthContext';

export type AppRole = 'super_admin' | 'admin' | 'staff' | 'sub_admin' | 'technician' | 'viewer' | 'user';
export type StaffPermission = 'booking_management' | 'user_management' | 'analytics' | 'kyc_review';

export function useRole(): {
  role: AppRole;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isLoaded: boolean;
  permissions: StaffPermission[];
  hasPermission: (perm: StaffPermission) => boolean;
} {
  const { meUser, isLoaded } = useAuthContext();
  const role = (meUser?.role as AppRole) ?? 'user';
  const permissions: StaffPermission[] = (meUser?.permissions as StaffPermission[]) ?? [];

  const isSuperAdmin = role === 'super_admin';
  const isAdmin      = role === 'admin' || role === 'super_admin';
  const isStaff      = role === 'staff' || role === 'sub_admin';

  function hasPermission(perm: StaffPermission): boolean {
    if (isAdmin) return true; // admins bypass all permission checks
    return permissions.includes(perm);
  }

  return { role, isSuperAdmin, isAdmin, isStaff, isLoaded, permissions, hasPermission };
}
