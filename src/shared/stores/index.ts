/**
 * Stores Index
 *
 * Central export point for all Zustand stores.
 */

// Auth store
export {
  useAuthStore,
  selectFullName,
  selectInitials,
  selectRoleName,
  selectIsAdmin,
  selectIsSuperAdmin,
  type AppUser,
} from './auth.store';

// Sidebar store
export {
  useSidebarStore,
  selectIsMenuExpanded,
  selectShowFullSidebar,
  selectSidebarWidth,
  type MenuItem,
} from './sidebar.store';

// Toast store
export {
  useToastStore,
  selectToastCount,
  selectToastsByVariant,
  selectErrorToasts,
  selectHasErrors,
  type Toast,
  type ToastInput,
  type ToastVariant,
  type ToastPosition,
} from './toast.store';
