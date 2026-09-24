/**
 * Sidebar Store
 *
 * Global state management for sidebar/navigation.
 * Manages sidebar visibility, collapsed state, and active menu.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================
// TYPES
// ============================================

/**
 * Menu item type
 */
export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  href?: string;
  permission?: string;
  children?: MenuItem[];
  badge?: string | number;
  badgeVariant?: 'default' | 'destructive' | 'success' | 'warning';
}

/**
 * Sidebar store state
 */
interface SidebarState {
  // Visibility
  isOpen: boolean;
  isCollapsed: boolean;
  isMobileOpen: boolean;

  // Active states
  activeMenuId: string | null;
  expandedMenuIds: string[];

  // Hover state (for collapsed sidebar)
  isHovering: boolean;
}

/**
 * Sidebar store actions
 */
interface SidebarActions {
  // Toggle actions
  toggle: () => void;
  open: () => void;
  close: () => void;

  // Collapse actions
  toggleCollapse: () => void;
  collapse: () => void;
  expand: () => void;

  // Mobile actions
  toggleMobile: () => void;
  openMobile: () => void;
  closeMobile: () => void;

  // Active menu
  setActiveMenu: (menuId: string | null) => void;

  // Expanded menus
  toggleExpandedMenu: (menuId: string) => void;
  expandMenu: (menuId: string) => void;
  collapseMenu: (menuId: string) => void;
  collapseAllMenus: () => void;

  // Hover state
  setHovering: (isHovering: boolean) => void;

  // Reset
  reset: () => void;
}

type SidebarStore = SidebarState & SidebarActions;

// ============================================
// INITIAL STATE
// ============================================

const initialState: SidebarState = {
  isOpen: true,
  isCollapsed: false,
  isMobileOpen: false,
  activeMenuId: null,
  expandedMenuIds: [],
  isHovering: false,
};

// ============================================
// STORE
// ============================================

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      // Initial state
      ...initialState,

      // Toggle actions
      toggle: () =>
        set((state) => ({ isOpen: !state.isOpen })),

      open: () =>
        set({ isOpen: true }),

      close: () =>
        set({ isOpen: false }),

      // Collapse actions
      toggleCollapse: () =>
        set((state) => ({
          isCollapsed: !state.isCollapsed,
          // Close all expanded menus when collapsing
          expandedMenuIds: state.isCollapsed ? state.expandedMenuIds : [],
        })),

      collapse: () =>
        set({
          isCollapsed: true,
          expandedMenuIds: [],
        }),

      expand: () =>
        set({ isCollapsed: false }),

      // Mobile actions
      toggleMobile: () =>
        set((state) => ({ isMobileOpen: !state.isMobileOpen })),

      openMobile: () =>
        set({ isMobileOpen: true }),

      closeMobile: () =>
        set({ isMobileOpen: false }),

      // Active menu
      setActiveMenu: (menuId) =>
        set({ activeMenuId: menuId }),

      // Expanded menus
      toggleExpandedMenu: (menuId) =>
        set((state) => {
          const isExpanded = state.expandedMenuIds.includes(menuId);
          return {
            expandedMenuIds: isExpanded
              ? state.expandedMenuIds.filter((id) => id !== menuId)
              : [...state.expandedMenuIds, menuId],
          };
        }),

      expandMenu: (menuId) =>
        set((state) => {
          if (state.expandedMenuIds.includes(menuId)) {
            return state;
          }
          return {
            expandedMenuIds: [...state.expandedMenuIds, menuId],
          };
        }),

      collapseMenu: (menuId) =>
        set((state) => ({
          expandedMenuIds: state.expandedMenuIds.filter((id) => id !== menuId),
        })),

      collapseAllMenus: () =>
        set({ expandedMenuIds: [] }),

      // Hover state
      setHovering: (isHovering) =>
        set({ isHovering }),

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'sidebar-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist user preferences
        isCollapsed: state.isCollapsed,
        expandedMenuIds: state.expandedMenuIds,
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

/**
 * Check if a menu is expanded
 */
export const selectIsMenuExpanded = (
  state: SidebarStore,
  menuId: string
): boolean => {
  return state.expandedMenuIds.includes(menuId);
};

/**
 * Check if sidebar should show full width
 * (not collapsed or is hovering while collapsed)
 */
export const selectShowFullSidebar = (state: SidebarStore): boolean => {
  return !state.isCollapsed || state.isHovering;
};

/**
 * Get sidebar width class
 */
export const selectSidebarWidth = (state: SidebarStore): string => {
  if (!state.isOpen) {
    return 'w-0';
  }
  if (state.isCollapsed && !state.isHovering) {
    return 'w-16';
  }
  return 'w-64';
};
