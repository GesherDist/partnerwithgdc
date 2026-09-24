/**
 * Toast Store
 *
 * Global state management for toast notifications.
 * Works with the Sonner toast library but provides a centralized interface.
 *
 * Note: For most cases, use the Sonner `toast` function directly.
 * This store is for programmatic toast management and history.
 */

import { create } from 'zustand';

// ============================================
// TYPES
// ============================================

/**
 * Toast variant types
 */
export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

/**
 * Toast position
 */
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/**
 * Toast item
 */
export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  createdAt: Date;
}

/**
 * Toast input (without id and createdAt)
 */
export type ToastInput = Omit<Toast, 'id' | 'createdAt'>;

/**
 * Toast store state
 */
interface ToastState {
  toasts: Toast[];
  history: Toast[];
  maxHistory: number;
  position: ToastPosition;
}

/**
 * Toast store actions
 */
interface ToastActions {
  // Add toasts
  addToast: (toast: ToastInput) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;

  // Remove toasts
  removeToast: (id: string) => void;
  clearAll: () => void;

  // History
  clearHistory: () => void;

  // Settings
  setPosition: (position: ToastPosition) => void;
  setMaxHistory: (max: number) => void;
}

type ToastStore = ToastState & ToastActions;

// ============================================
// HELPERS
// ============================================

/**
 * Generate unique ID
 */
function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Default toast duration by variant (ms)
 */
const DEFAULT_DURATION: Record<ToastVariant, number> = {
  default: 4000,
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 4000,
};

// ============================================
// INITIAL STATE
// ============================================

const initialState: ToastState = {
  toasts: [],
  history: [],
  maxHistory: 50,
  position: 'bottom-right',
};

// ============================================
// STORE
// ============================================

export const useToastStore = create<ToastStore>()((set, get) => ({
  // Initial state
  ...initialState,

  // Add toast
  addToast: (input) => {
    const id = generateId();
    const toast: Toast = {
      ...input,
      id,
      duration: input.duration ?? DEFAULT_DURATION[input.variant],
      dismissible: input.dismissible ?? true,
      createdAt: new Date(),
    };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // Auto-remove after duration
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, toast.duration);
    }

    return id;
  },

  // Shorthand methods
  success: (title, description) =>
    get().addToast({ variant: 'success', title, description }),

  error: (title, description) =>
    get().addToast({ variant: 'error', title, description }),

  warning: (title, description) =>
    get().addToast({ variant: 'warning', title, description }),

  info: (title, description) =>
    get().addToast({ variant: 'info', title, description }),

  // Remove toast
  removeToast: (id) =>
    set((state) => {
      const toast = state.toasts.find((t) => t.id === id);
      const newToasts = state.toasts.filter((t) => t.id !== id);

      // Add to history if toast was found
      let newHistory = state.history;
      if (toast) {
        newHistory = [toast, ...state.history].slice(0, state.maxHistory);
      }

      return {
        toasts: newToasts,
        history: newHistory,
      };
    }),

  // Clear all toasts
  clearAll: () =>
    set((state) => ({
      toasts: [],
      history: [...state.toasts, ...state.history].slice(0, state.maxHistory),
    })),

  // Clear history
  clearHistory: () =>
    set({ history: [] }),

  // Settings
  setPosition: (position) =>
    set({ position }),

  setMaxHistory: (maxHistory) =>
    set((state) => ({
      maxHistory,
      history: state.history.slice(0, maxHistory),
    })),
}));

// ============================================
// SELECTORS
// ============================================

/**
 * Get active toasts count
 */
export const selectToastCount = (state: ToastStore): number => {
  return state.toasts.length;
};

/**
 * Get toasts by variant
 */
export const selectToastsByVariant = (
  state: ToastStore,
  variant: ToastVariant
): Toast[] => {
  return state.toasts.filter((t) => t.variant === variant);
};

/**
 * Get error toasts
 */
export const selectErrorToasts = (state: ToastStore): Toast[] => {
  return state.toasts.filter((t) => t.variant === 'error');
};

/**
 * Check if there are any error toasts
 */
export const selectHasErrors = (state: ToastStore): boolean => {
  return state.toasts.some((t) => t.variant === 'error');
};
