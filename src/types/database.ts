export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Tables = {
  plans: {
    id: string;
    name: string;
    price_cents: number;
    currency: string;
    interval: "month" | "year";
    features: Json;
    sort_order: number;
    is_active: boolean;
  };
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
    platform_fee_fixed: number;
    currency: string;
    default_tax_percent: number;
    email: string | null;
    phone: string | null;
    website: string | null;
    fiskaly_tss_id: string | null;
    fiskaly_client_id: string | null;
    steuernummer: string | null;
    ust_id_nr: string | null;
    onboarding_completed: boolean;
    trial_ends_at: string | null;
    plan_id: string | null;
    stripe_subscription_id: string | null;
    subscription_status:
      | "trialing"
      | "active"
      | "past_due"
      | "canceled"
      | "unpaid"
      | null;
    feature_flags: Json;
    ai_concierge_config: Json | null;
    created_at: string;
    updated_at: string;
  };
  api_keys: {
    id: string;
    org_id: string;
    name: string;
    key_hash: string;
    key_prefix: string;
    scopes: string[];
    last_used_at: string | null;
    expires_at: string | null;
    created_at: string;
    revoked_at: string | null;
  };
  webhook_configs: {
    id: string;
    org_id: string;
    url: string;
    secret: string;
    events: string[];
    is_active: boolean;
    failure_count: number;
    created_at: string;
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
    accepting_orders: boolean;
    payment_online_enabled: boolean;
    payment_at_bar_enabled: boolean;
    payment_card_at_table_enabled: boolean;
    stripe_terminal_location_id: string | null;
    in_person_payment_location: "bar" | "counter" | "table";
    menu_locale:
      | "de"
      | "sr"
      | "tr"
      | "hr"
      | "ar"
      | "fr"
      | "es"
      | "it"
      | "ru";
    default_locale:
      | "de"
      | "en"
      | "sr"
      | "tr"
      | "hr"
      | "ar"
      | "fr"
      | "es"
      | "it"
      | "ru";
    available_locales: string[];
    google_review_url: string | null;
    ordering_enabled: boolean;
    ai_concierge_enabled: boolean;
    ai_playbook: string | null;
    ai_concierge_config: Json | null;
    rejection_ban_threshold: number;
    rejection_ban_minutes: number;
    rejection_strike_window_minutes: number;
    created_at: string;
    updated_at: string;
  };
  table_order_blocks: {
    id: string;
    location_id: string;
    table_id: string;
    device_fingerprint: string;
    blocked_until: string;
    strike_count: number;
    lifted_at: string | null;
    lifted_by_staff_id: string | null;
    created_at: string;
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
    assigned_staff_id: string | null;
    created_at: string;
    deleted_at: string | null;
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
    schedule_enabled: boolean;
    schedule_start: string | null;
    schedule_end: string | null;
    schedule_days: number[];
    menu_section: string;
    printer_target: "kitchen" | "bar" | "receipt";
    created_at: string;
    deleted_at: string | null;
  };
  printer_configs: {
    id: string;
    location_id: string;
    name: string;
    type: "usb" | "lan" | "cloud";
    ip_address: string | null;
    port: number;
    usb_vendor: string | null;
    usb_product: string | null;
    mac_address: string | null;
    paper_width: number;
    is_default: boolean;
    auto_print: boolean;
    print_for: ("kitchen" | "receipt" | "bar")[];
    created_at: string;
    updated_at: string;
  };
  print_jobs: {
    id: string;
    printer_id: string;
    location_id: string;
    order_id: string | null;
    job_type: string;
    payload: string;
    status: "pending" | "printing" | "done" | "failed";
    attempts: number;
    created_at: string;
    picked_at: string | null;
    done_at: string | null;
  };
  pos_integrations: {
    id: string;
    location_id: string;
    provider:
      | "deliverect"
      | "orderbird"
      | "lightspeed"
      | "ready2order"
      | "custom";
    status: "disconnected" | "connected" | "error";
    config: Json;
    external_location_id: string | null;
    last_sync_at: string | null;
    last_error: string | null;
    created_at: string;
    updated_at: string;
  };
  pos_order_links: {
    id: string;
    pos_integration_id: string;
    external_order_id: string;
    order_id: string;
    created_at: string;
  };
  pos_table_mappings: {
    id: string;
    location_id: string;
    provider:
      | "deliverect"
      | "orderbird"
      | "lightspeed"
      | "ready2order"
      | "custom";
    external_table_key: string;
    table_id: string;
    created_at: string;
    updated_at: string;
  };
  pos_inbound_events: {
    id: string;
    pos_integration_id: string;
    event_type: string;
    external_id: string | null;
    payload_hash: string;
    processing_status:
      | "received"
      | "processed"
      | "duplicate"
      | "rejected"
      | "failed";
    http_status: number | null;
    error_message: string | null;
    order_id: string | null;
    session_id: string | null;
    duration_ms: number | null;
    created_at: string;
  };
  pos_outbound_events: {
    id: string;
    pos_integration_id: string;
    event_type: string;
    success: boolean;
    error_message: string | null;
    created_at: string;
  };
  session_payment_intents: {
    id: string;
    session_id: string;
    stripe_payment_intent_id: string;
    idempotency_key: string;
    amount_cents: number;
    status: "pending" | "processing" | "succeeded" | "failed" | "cancelled";
    created_at: string;
    updated_at: string;
  };
  terminal_readers: {
    id: string;
    location_id: string;
    org_id: string;
    stripe_reader_id: string;
    label: string;
    status: "online" | "offline";
    last_seen_at: string | null;
    created_at: string;
    updated_at: string;
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
    requires_serve_size: boolean;
    serve_size_presets: string[] | null;
    allow_custom_serve_size: boolean;
    tax_rate: number | null;
    ai_description: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
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
    bill_status: "open" | "settled" | "void";
    access_state: "open" | "locked" | "closing" | "closed";
    opened_by: "qr" | "staff" | "pos";
    closed_by: "qr" | "staff" | "pos" | "timeout" | "system" | null;
    pos_table_external_id: string | null;
    payment_authority: "vera" | "pos";
    order_pin_hash: string | null;
    order_pin_set_at: string | null;
    approved_by_staff_id: string | null;
    opened_at: string;
    closed_at: string | null;
    guest_email: string | null;
  };
  session_devices: {
    id: string;
    session_id: string;
    device_fingerprint: string;
    device_token: string;
    pin_verified_at: string;
    last_seen_at: string;
    revoked_at: string | null;
    user_agent: string | null;
    created_at: string;
  };
  orders: {
    id: string;
    location_id: string;
    table_id: string | null;
    session_id: string | null;
    order_number: number;
    status:
      | "pending_approval"
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
      | "failed"
      | "pos_online";
    payment_method:
      | "online"
      | "at_bar"
      | "card_at_table"
      | "card_terminal"
      | "unset"
      | "pos"
      | "pos_online";
    payment_requested_at: string | null;
    notes: string | null;
    rejection_reason: string | null;
    estimated_prep_minutes: number | null;
    accepted_at: string | null;
    preparing_at: string | null;
    ready_at: string | null;
    delivered_at: string | null;
    receipt_sent_at: string | null;
    is_takeaway: boolean;
    tse_signature: string | null;
    tse_data: Json | null;
    refund_id: string | null;
    refund_reason: string | null;
    refunded_by: string | null;
    refunded_at: string | null;
    tip_amount: number;
    tip_staff_id: string | null;
    is_split: boolean;
    promo_code_id: string | null;
    discount_amount: number;
    created_by_staff_id: string | null;
    order_source: "qr" | "staff" | "kiosk" | "pos";
    device_fingerprint: string | null;
    requires_session_open: boolean;
    idempotency_key: string | null;
    pos_integration_id: string | null;
    external_pos_order_id: string | null;
    beleg_token: string | null;
    beleg_snapshot: Json | null;
    has_storno: boolean;
    storno_total: number;
    created_at: string;
    updated_at: string;
  };
  order_events: {
    id: string;
    order_id: string;
    event_type: string;
    payload: Json;
    idempotency_key: string | null;
    actor_type: string | null;
    actor_id: string | null;
    created_at: string;
  };
  outbox_events: {
    id: string;
    aggregate_type: string;
    aggregate_id: string;
    domain: "fulfillment" | "fiscal" | "integration";
    event_type: string;
    payload: Json;
    status: "pending" | "processing" | "done" | "failed";
    attempts: number;
    max_attempts: number;
    next_retry_at: string;
    last_error: string | null;
    created_at: string;
    processed_at: string | null;
  };
  dead_letter_queue: {
    id: string;
    org_id: string;
    job_type: string;
    payload: Json;
    error_message: string | null;
    attempts: number;
    max_attempts: number;
    created_at: string;
    resolved_at: string | null;
    resolved_by: string | null;
  };
  audit_log: {
    id: number;
    org_id: string;
    user_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    old_value: Json | null;
    new_value: Json | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
  };
  order_channel_deliveries: {
    id: string;
    order_id: string;
    channel: "dashboard" | "pos" | "cloud_print" | "webhook";
    provider: string;
    status: "pending" | "delivered" | "failed" | "skipped";
    external_id: string | null;
    attempts: number;
    last_error: string | null;
    delivered_at: string | null;
    created_at: string;
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
    menu_section: "drinks" | "food" | "desserts";
    tax_rate: number;
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
    role: "owner" | "manager" | "staff" | "kitchen" | "waiter";
    name: string;
    email: string | null;
    is_active: boolean;
    is_platform_admin: boolean;
    created_at: string;
    deleted_at: string | null;
  };
  staff_locations: {
    staff_id: string;
    location_id: string;
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
  daily_closings: {
    id: string;
    org_id: string;
    location_id: string;
    business_date: string;
    total_gross: number;
    total_net: number;
    total_tax: number;
    total_cash: number;
    total_non_cash: number;
    total_tips: number;
    vat_summary: Json;
    order_count: number;
    refund_count: number;
    refund_total: number;
    tse_closing_signature: string | null;
    tse_closing_data: Json | null;
    closed_by: string | null;
    closed_at: string;
    created_at: string;
  };
  webhook_events: {
    id: string;
    event_type: string;
    processed_at: string;
    payload: Json | null;
    status: "processing" | "completed" | "failed";
  };
  audit_log_legacy_pre_g3: {
    id: string;
    action: string;
    order_id: string | null;
    session_id: string | null;
    table_id: string | null;
    staff_id: string | null;
    amount: number | null;
    reason: string | null;
    metadata: Json;
    created_at: string;
  };
  split_payments: {
    id: string;
    order_id: string;
    amount: number;
    tip_amount: number;
    stripe_payment_intent_id: string | null;
    payment_status: string;
    paid_by_session_id: string | null;
    items: Json | null;
    created_at: string;
  };
  storno_records: {
    id: string;
    org_id: string;
    location_id: string;
    original_order_id: string;
    storno_amount: number;
    storno_reason: string;
    storno_type: "full" | "partial";
    performed_by: string;
    tse_storno_signature: string | null;
    tse_storno_data: Json | null;
    tse_storno_tx_id: string | null;
    original_tse_tx_id: string | null;
    original_tse_signature: string | null;
    stripe_refund_id: string | null;
    refund_status: "pending" | "tse_signed" | "refunded" | "failed";
    created_at: string;
  };
  promo_codes: {
    id: string;
    location_id: string;
    code: string;
    discount_type: "percent" | "fixed";
    discount_value: number;
    min_order_amount: number;
    max_uses: number | null;
    used_count: number;
    valid_from: string;
    valid_until: string | null;
    is_active: boolean;
    created_at: string;
  };
  upsell_rules: {
    id: string;
    location_id: string;
    trigger_product_id: string | null;
    trigger_category_id: string | null;
    suggest_product_id: string;
    message: string | null;
    sort_order: number;
    is_active: boolean;
    created_at: string;
  };
  order_feedback: {
    id: string;
    order_id: string;
    location_id: string;
    rating: number;
    comment: string | null;
    created_at: string;
  };
  table_transfers: {
    id: string;
    location_id: string;
    from_table_id: string;
    to_table_id: string;
    from_session_id: string | null;
    to_session_id: string | null;
    transferred_by: string;
    transfer_type: "full" | "partial";
    order_ids: string[];
    note: string | null;
    created_at: string;
  };
  ai_credits: {
    org_id: string;
    balance: number;
    lifetime_purchased: number;
    lifetime_used: number;
    updated_at: string;
  };
  ai_sessions: {
    id: string;
    org_id: string;
    location_id: string;
    table_id: string;
    session_token: string;
    language: string;
    guest_preferences: Json;
    messages: Json;
    tokens_used: number;
    credits_used: number;
    products_recommended: string[];
    products_added: string[];
    conversion_count: number;
    status: "active" | "completed" | "expired";
    created_at: string;
    completed_at: string | null;
    scroll_context: Json | null;
    nudges_shown: string[];
    guest_rating: number | null;
    guest_feedback: string | null;
    order_draft: Json | null;
    linked_order_ids: string[];
    last_order_status_snapshot: Json | null;
  };
  ai_order_events: {
    id: string;
    ai_session_id: string;
    order_id: string | null;
    event_type:
      | "draft_updated"
      | "cart_applied"
      | "submit_requested"
      | "order_created"
      | "status_notified";
    payload: Json;
    created_at: string;
  };
  denis_timeline: {
    id: string;
    ai_session_id: string;
    seq: number;
    event_type: string;
    payload: Json;
    trace_id: string | null;
    context_hash: string | null;
    created_at: string;
  };
  ai_examples: {
    id: string;
    org_id: string;
    location_id: string | null;
    category: "order" | "recommend" | "clarify" | "confirm" | "general";
    user_message: string;
    assistant_message: string;
    assistant_json: Json | null;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  ai_insights: {
    id: string;
    org_id: string;
    location_id: string | null;
    type:
      | "menu_gap"
      | "demand_signal"
      | "conversion"
      | "alert"
      | "feedback_summary";
    severity: "info" | "warning" | "critical";
    title: string;
    detail: string;
    metadata: Json;
    insight_date: string;
    is_read: boolean;
    created_at: string;
  };
  ai_credit_packages: {
    id: string;
    name: string;
    credits: number;
    price_cents: number;
    currency: string;
    is_active: boolean;
    sort_order: number;
    created_at: string;
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
      increment_promo_used_count: {
        Args: { p_promo_id: string };
        Returns: boolean;
      };
      decrement_ai_credits: {
        Args: { p_org_id: string; p_amount: number };
        Returns: number;
      };
      add_ai_credits: {
        Args: { p_org_id: string; p_amount: number };
        Returns: number;
      };
      claim_outbox_events: {
        Args: { p_limit?: number };
        Returns: Database["public"]["Tables"]["outbox_events"][];
      };
      complete_outbox_event: {
        Args: {
          p_id: string;
          p_success: boolean;
          p_error?: string | null;
          p_next_retry_at?: string | null;
        };
        Returns: void;
      };
      create_guest_order_tx: {
        Args: {
          p_location_id: string;
          p_table_id: string;
          p_session_id: string | null;
          p_status: string;
          p_requires_session: boolean;
          p_idempotency_key: string | null;
          p_order_payload: Json;
          p_items: Json;
          p_promo_code_id: string | null;
          p_consume_promo: boolean;
        };
        Returns: Json;
      };
      create_pos_order_tx: {
        Args: {
          p_pos_integration_id: string;
          p_location_id: string;
          p_table_id: string;
          p_external_order_id: string;
          p_idempotency_key: string | null;
          p_order_payload: Json;
          p_items: Json;
        };
        Returns: Json;
      };
      create_staff_order_tx: {
        Args: {
          p_location_id: string;
          p_table_id: string;
          p_session_id: string;
          p_staff_id: string;
          p_payment_method: string;
          p_is_takeaway: boolean;
          p_notes: string | null;
          p_order_payload: Json;
          p_items: Json;
        };
        Returns: Json;
      };
      approve_order_access_tx: {
        Args: {
          p_order_id: string;
          p_staff_id: string;
          p_pin_hash: string;
          p_device_fingerprint?: string | null;
          p_user_agent?: string | null;
        };
        Returns: Json;
      };
      reject_order_access_tx: {
        Args: {
          p_order_id: string;
          p_rejection_reason?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
  };
}
