export function cacheImmutable(maxAge = 31536000) {
  return { "Cache-Control": `public, max-age=${maxAge}, immutable` };
}

export function cacheStaleWhileRevalidate(maxAge = 60, stale = 300) {
  return {
    "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${stale}`,
  };
}

export function noCache() {
  return { "Cache-Control": "private, no-cache, no-store" };
}
