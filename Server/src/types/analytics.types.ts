export interface Summary {
  totalRevenue: number;
  totalOrders: number;
  avgDeliveryTime: number;
  deliveryRate: number;
}

export interface RegionRevenue {
  region: string;
  revenue: number;
  orders: number;
  stores: number;
}