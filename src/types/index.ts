import type { Database } from "./database";

export type Organization =
  Database["public"]["Tables"]["organizations"]["Row"];
export type Location = Database["public"]["Tables"]["locations"]["Row"];
export type Zone = Database["public"]["Tables"]["zones"]["Row"];
export type Table = Database["public"]["Tables"]["tables"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ModifierGroup =
  Database["public"]["Tables"]["modifier_groups"]["Row"];
export type Modifier = Database["public"]["Tables"]["modifiers"]["Row"];
export type TableSession =
  Database["public"]["Tables"]["table_sessions"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type OrderItemModifier =
  Database["public"]["Tables"]["order_item_modifiers"]["Row"];
export type Staff = Database["public"]["Tables"]["staff"]["Row"];
export type WaiterCall = Database["public"]["Tables"]["waiter_calls"]["Row"];
export type SplitPayment = Database["public"]["Tables"]["split_payments"]["Row"];
export type PromoCode = Database["public"]["Tables"]["promo_codes"]["Row"];
export type UpsellRule = Database["public"]["Tables"]["upsell_rules"]["Row"];
export type OrderFeedback =
  Database["public"]["Tables"]["order_feedback"]["Row"];
export type AiCredits = Database["public"]["Tables"]["ai_credits"]["Row"];
export type AiSession = Database["public"]["Tables"]["ai_sessions"]["Row"];
export type AiInsight = Database["public"]["Tables"]["ai_insights"]["Row"];
export type AiCreditPackage =
  Database["public"]["Tables"]["ai_credit_packages"]["Row"];

export type ProductWithModifiers = Product & {
  modifier_groups: (ModifierGroup & { modifiers: Modifier[] })[];
};

export type OrderWithDetails = Order & {
  order_items: (OrderItem & {
    order_item_modifiers: OrderItemModifier[];
  })[];
  tables?: { name: string; zone?: { name: string } | null } | null;
  table_sessions?: { guest_email: string | null } | null;
  refund_staff?: { name: string } | null;
  tip_staff?: { name: string } | null;
  split_payments?: SplitPayment[];
  audit_log?: {
    action: string;
    amount: number | null;
    created_at: string;
  }[];
  transferred_from_table_name?: string | null;
};

export type OrderStatus = Order["status"];
export type PaymentStatus = Order["payment_status"];
export type StaffRole = Staff["role"];
