const FISKALY_BASE_URL =
  "https://kassensichv-middleware.fiskaly.com/api/v2";

export type FiskalyVatRate = "NORMAL" | "REDUCED_1" | "NULL";
export type FiskalyPaymentType = "CASH" | "NON_CASH";

export type FiskalyReceiptSchema = {
  standard_v1: {
    receipt: {
      // "CANCELLATION" = AVBelegabbruch (abort). For storno use "RECEIPT" with negative amounts.
      receipt_type: "RECEIPT" | "CANCELLATION";
      amounts_per_vat_rate: Array<{ vat_rate: FiskalyVatRate; amount: string }>;
      amounts_per_payment_type: Array<{
        payment_type: FiskalyPaymentType;
        amount: string;
        currency_code: string;
      }>;
    };
  };
};

export type FiskalyCreateTransactionInput = {
  tx_id?: string;
  client_id: string;
  schema?: FiskalyReceiptSchema;
  metadata?: Record<string, string>;
};

export type FiskalyTransactionResponse = {
  _id: string;
  number: number;
  time_start: number;
  time_end?: number;
  tss_serial_number?: string;
  client_serial_number?: string;
  state: string;
  qr_code_data?: string;
  signature?: {
    value?: string;
    counter?: string | number;
    algorithm?: string;
    public_key?: string;
  };
  revision?: number;
  latest_revision?: number;
};

export type FiskalyTssResponse = {
  _id: string;
  state: string;
  admin_puk?: string;
  description?: string;
  serial_number?: string;
};

export type FiskalyClientResponse = {
  _id: string;
  serial_number: string;
  state: string;
  tss_id: string;
};

type AuthResponse = {
  access_token: string;
  access_token_expires_at?: number;
  access_token_expires_in?: number;
};

type RequestOptions = {
  timeoutMs?: number;
};

export function isFiskalyConfigured(): boolean {
  return Boolean(
    process.env.FISKALY_API_KEY?.trim() &&
      process.env.FISKALY_API_SECRET?.trim()
  );
}

export function getFiskalyAdminPin(): string {
  return process.env.FISKALY_TSS_ADMIN_PIN?.trim() || "543210";
}

export class FiskalyClient {
  private accessToken: string | null = null;
  private tokenExpiresAtMs = 0;

  private async request<T>(
    path: string,
    init: RequestInit = {},
    options: RequestOptions = {}
  ): Promise<T> {
    const token = await this.authenticate();
    if (!token) {
      throw new Error("Fiskaly is not configured.");
    }

    const controller = new AbortController();
    const timeout = options.timeoutMs
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : null;

    try {
      const res = await fetch(`${FISKALY_BASE_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init.headers ?? {}),
        },
      });

      if (res.status === 401) {
        this.accessToken = null;
        this.tokenExpiresAtMs = 0;
        const retryToken = await this.authenticate(true);
        if (!retryToken) {
          throw new Error("Fiskaly authentication failed.");
        }
        const retry = await fetch(`${FISKALY_BASE_URL}${path}`, {
          ...init,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${retryToken}`,
            ...(init.headers ?? {}),
          },
        });
        if (!retry.ok) {
          const body = await retry.text();
          throw new Error(`Fiskaly request failed (${retry.status}): ${body}`);
        }
        if (retry.status === 204) {
          return {} as T;
        }
        return retry.json() as Promise<T>;
      }

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Fiskaly request failed (${res.status}): ${body}`);
      }

      if (res.status === 204) {
        return {} as T;
      }

      return res.json() as Promise<T>;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async authenticate(force = false): Promise<string | null> {
    if (!isFiskalyConfigured()) {
      return null;
    }

    if (
      !force &&
      this.accessToken &&
      Date.now() < this.tokenExpiresAtMs - 60_000
    ) {
      return this.accessToken;
    }

    const res = await fetch(`${FISKALY_BASE_URL}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.FISKALY_API_KEY,
        api_secret: process.env.FISKALY_API_SECRET,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Fiskaly auth failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as AuthResponse;
    this.accessToken = data.access_token;

    if (data.access_token_expires_at) {
      this.tokenExpiresAtMs = data.access_token_expires_at * 1000;
    } else if (data.access_token_expires_in) {
      this.tokenExpiresAtMs = Date.now() + data.access_token_expires_in * 1000;
    } else {
      this.tokenExpiresAtMs = Date.now() + 23 * 60 * 60 * 1000;
    }

    return this.accessToken;
  }

  async createTss(
    tssId: string,
    metadata?: Record<string, string>
  ): Promise<FiskalyTssResponse> {
    return this.request<FiskalyTssResponse>(`/tss/${tssId}`, {
      method: "PUT",
      body: JSON.stringify({ metadata }),
    });
  }

  async updateTss(
    tssId: string,
    body: {
      state: "UNINITIALIZED" | "INITIALIZED" | "DISABLED";
      description?: string;
      metadata?: Record<string, string>;
    },
    options?: RequestOptions
  ): Promise<FiskalyTssResponse> {
    return this.request<FiskalyTssResponse>(
      `/tss/${tssId}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
      options
    );
  }

  async changeAdminPin(
    tssId: string,
    adminPuk: string,
    newAdminPin: string
  ): Promise<void> {
    await this.request(`/tss/${tssId}/admin`, {
      method: "PATCH",
      body: JSON.stringify({
        admin_puk: adminPuk,
        new_admin_pin: newAdminPin,
      }),
    });
  }

  async adminAuth(tssId: string, adminPin: string): Promise<void> {
    await this.request(`/tss/${tssId}/admin/auth`, {
      method: "POST",
      body: JSON.stringify({ admin_pin: adminPin }),
    });
  }

  async createClient(
    tssId: string,
    clientId: string,
    serialNumber: string,
    metadata?: Record<string, string>
  ): Promise<FiskalyClientResponse> {
    return this.request<FiskalyClientResponse>(
      `/tss/${tssId}/client/${clientId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          serial_number: serialNumber,
          metadata,
        }),
      }
    );
  }

  private async upsertTransaction(
    tssId: string,
    txId: string,
    revision: number,
    body: Record<string, unknown>
  ): Promise<FiskalyTransactionResponse> {
    return this.request<FiskalyTransactionResponse>(
      `/tss/${tssId}/tx/${txId}?tx_revision=${revision}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      }
    );
  }

  async createTransaction(
    tssId: string,
    data: FiskalyCreateTransactionInput
  ): Promise<FiskalyTransactionResponse> {
    const txId = data.tx_id ?? crypto.randomUUID();

    await this.upsertTransaction(tssId, txId, 1, {
      state: "ACTIVE",
      client_id: data.client_id,
      metadata: data.metadata,
    });

    if (!data.schema) {
      throw new Error("Receipt schema is required to finish a Fiskaly transaction.");
    }

    return this.upsertTransaction(tssId, txId, 2, {
      state: "FINISHED",
      client_id: data.client_id,
      schema: data.schema,
      metadata: data.metadata,
    });
  }

  async getTransaction(
    tssId: string,
    txId: string
  ): Promise<FiskalyTransactionResponse> {
    return this.request<FiskalyTransactionResponse>(`/tss/${tssId}/tx/${txId}`);
  }
}

let sharedClient: FiskalyClient | null = null;

export function getFiskalyClient(): FiskalyClient {
  if (!sharedClient) {
    sharedClient = new FiskalyClient();
  }
  return sharedClient;
}
