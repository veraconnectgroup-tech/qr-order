import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";

/** In-memory catalog slice for keyword RAG (no DB round-trip). */
export type MenuRagCatalog = Record<string, AiCatalogProduct>;

/** Compact evidence injected as `catalog.rag` pointer (ADR-023 §7). */
export type MenuRagEvidence = {
  productIds: string[];
  snippet: string;
};

export type MenuRagRetrieveOptions = {
  maxResults?: number;
  /** Precomputed product vectors (Redis / OpenAI batch). */
  embeddings?: MenuRagEmbeddingIndex;
  /** Query vector in the same space as `embeddings`. */
  queryVector?: number[];
};

/** Product id → embedding vector for semantic menu RAG (E2). */
export type MenuRagEmbeddingIndex = Record<string, number[]>;

export type MenuRagEmbeddingSpace = "openai" | "local";

export type MenuRagEmbeddingBundle = {
  index: MenuRagEmbeddingIndex;
  space: MenuRagEmbeddingSpace;
};

/** Gate inputs — manifest capability and/or elite profile override. */
export type MenuRagGateInput = {
  /** `manifest.capabilities.catalog_rag` (0–4 lattice). */
  catalogRagLevel?: number;
  /** Resolved `elite.menuRagEnabled` from ConciergeConfig. */
  menuRagEnabled?: boolean;
};

/** Minimum `catalog_rag` capability before RAG is on by default. */
export const MENU_RAG_MIN_CATALOG_CAPABILITY = 2;
