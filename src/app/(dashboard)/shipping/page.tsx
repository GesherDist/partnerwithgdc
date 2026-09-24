/**
 * Shipping Page
 *
 * Displays shipping tracking emails and status updates.
 */

import { Metadata } from 'next';
import { ShippingContent } from './shipping-content';

export const metadata: Metadata = {
  title: 'Shipping | Gesher Distribution',
  description: 'Shipping tracking and email management',
};

export default function ShippingPage() {
  return <ShippingContent />;
}
