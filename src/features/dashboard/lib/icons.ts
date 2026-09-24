/**
 * Dashboard Icon Mapping
 *
 * Maps icon string names to Lucide icon components.
 * This allows icons to be stored as serializable strings in data
 * while being rendered as actual components in Client Components.
 */

import {
  Package,
  Users,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  FileText,
  Truck,
  BarChart3,
  Percent,
  AlertTriangle,
  CreditCard,
  Warehouse,
  Target,
  Clock,
  type LucideIcon,
} from 'lucide-react';

import type { DashboardIconName } from '../types';

// ============================================
// ICON MAP
// ============================================

export const iconMap: Record<DashboardIconName, LucideIcon> = {
  'package': Package,
  'users': Users,
  'trending-up': TrendingUp,
  'dollar-sign': DollarSign,
  'shopping-cart': ShoppingCart,
  'file-text': FileText,
  'truck': Truck,
  'bar-chart': BarChart3,
  'percent': Percent,
  'alert-triangle': AlertTriangle,
  'credit-card': CreditCard,
  'warehouse': Warehouse,
  'target': Target,
  'clock': Clock,
};

// ============================================
// HELPER FUNCTION
// ============================================

/**
 * Get Lucide icon component from icon name
 */
export function getIcon(name: DashboardIconName): LucideIcon {
  return iconMap[name] || Package;
}
