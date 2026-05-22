export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Tables = {
  organizations: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    cover_image_url: string | null;
    description: string | null;
    stripe_account_id: string | null;
    stripe_onboarded: boolean;
    platform_fee_percent: number;
    currency: string;
    default_tax_percent: number;
    email: string | null;
    phone: string | null;
    website: string | null;
    created_at: string;
    updated_at: string;
  };
  locations: {
    id: string;
    org_id: string;
    name: string;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    country: string;
    timezone: string;
    operating_hours: Json;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  zones: {
    id: string;
    location_id: string;
    name: string;
    sort_order: number;
    is_active: boolean;
  };
  tables: {
    id: string;
    location_id: string;
    zone_id: string | null;
    name: string;
    qr_token: string;
    seats: number;
    is_active: boolean;
    created_at: string;
  };
  categories: {
    id: string;
    location_id: string;
    name: string;
    name_en: string | null;
    description: string | null;
    image_url: string | null;
    sort_order: number;
    is_active: boolean;
    available_from: string | null;
    available_until: string | null;
    available_days: number[];
    created_at: string;
  };
  products: {
    id: string;
    location_id: string;
    category_id: string | null;
    name: string;
    name_en: string | null;
    description: string | null;
    description_en: string | null;
    price: number;
    image_url: string | null;
    is_available: boolean;
    sort_order: number;
    prep_time_minutes: number | null;
    allergens: string[] | null;
    tags: string[] | null;
    created_at: string;
    updated_at: string;
  };
  modifier_groups: {
    id: string;
    product_id: string;
    name: string;
    name_en: string | null;
    min_select: number;
    max_select: number;
    is_required: boolean;
    sort_order: number;
  };
  modifiers: {
    id: string;
    group_id: string;
    name: string;
    name_en: string | null;
    price: number;
    is_available: boolean;
    sort_order: number;
  };
  table_sessions: {
    id: string;
    table_id: string;
    location_id: string;
    session_token: string;
    status: "active" | "closed";
    opened_at: string;
    closed_at: string | null;
    guest_email: string | null;
  };
  orders: {
    id: string;
    location_id: string;
    table_id: string | null;
    session_id: string | null;
    order_number: number;
    status:
      | "pending"
      | "accepted"
      | "preparing"
      | "ready"
      | "delivered"
      | "rejected"
      | "cancelled";
    subtotal: number;
    tax_percent: number;
    tax_amount: number;
    total: number;
    stripe_payment_intent_id: string | null;
    payment_status:
      | "pending"
      | "processing"
      | "paid"
      | "refunded"
      | "partial_refund"
      | "failed";
    notes: string | null;
    rejection_reason: string | null;
    estimated_prep_minutes: number | null;
    accepted_at: string | null;
    preparing_at: string | null;
    ready_at: string | null;
    delivered_at: string | null;
    created_at: string;
    updated_at: string;
  };
  order_items: {
    id: string;
    order_id: string;
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    notes: string | null;
    total: number;
  };
  order_item_modifiers: {
    id: string;
    order_item_id: string;
    modifier_id: string | null;
    modifier_name: string;
    price: number;
  };
  staff: {
    id: string;
    user_id: string;
    org_id: string;
    location_id: string | null;
    role: "owner" | "manager" | "staff" | "kitchen";
    name: string;
    email: string | null;
    is_active: boolean;
    created_at: string;
  };
  waiter_calls: {
    id: string;
    table_id: string;
    location_id: string;
    session_id: string | null;
    status: "pending" | "acknowledged" | "resolved";
    created_at: string;
    acknowledged_at: string | null;
    resolved_at: string | null;
  };
  daily_order_counters: {
    id: string;
    location_id: string;
    date: string;
    last_number: number;
  };
};

type TableDef<T extends keyof Tables> = {
  Row: Tables[T];
  Insert: Partial<Tables[T]>;
  Update: Partial<Tables[T]>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      [K in keyof Tables]: TableDef<K>;
    };
    Views: Record<string, never>;
    Functions: {
      get_next_order_number: {
        Args: { p_location_id: string };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
  };
}
