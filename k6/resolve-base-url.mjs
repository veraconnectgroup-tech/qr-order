#!/usr/bin/env node
/**
 * Prints BASE_URL for k6 — uses BASE_URL env if set, else first healthy local port.
 */
const ports = [3000, 3001, 3002];

async function isHealthy(port) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 800);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (process.env.BASE_URL?.trim()) {
    console.log(process.env.BASE_URL.trim());
    return;
  }

  for (const port of ports) {
    if (await isHealthy(port)) {
      console.log(`http://localhost:${port}`);
      return;
    }
  }

  console.error(
    "No dev server found on ports 3000–3002. Start with `pnpm dev` or set BASE_URL."
  );
  process.exit(1);
}

main();
