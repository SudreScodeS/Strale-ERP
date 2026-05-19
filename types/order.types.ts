// types/order.types.ts
// Order domain: order views, delivery urgency, and related UI types.

import type { Order } from './index';

/** Order enriched with creator name for display */
export interface OrderView extends Order {
  createdByName: string;
}

/** Delivery urgency classification */
export interface DeliveryUrgency {
  label: string;
  level: 'critical' | 'high' | 'medium' | 'low';
  days: number;
}
