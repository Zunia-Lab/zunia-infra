/**
 * Status page data source for status.zunialab.com.
 *
 * Polls configured RPC / REST / indexer / API health endpoints and exposes a
 * public JSON summary. Deploy as a Vercel cron or Cloudflare Worker.
 */

export type ComponentStatus = "operational" | "degraded" | "down" | "unknown";

export interface StatusComponent {
  id: string;
  name: string;
  status: ComponentStatus;
  latencyMs?: number;
  checkedAt: string;
  detail?: string;
}

const ENDPOINTS: { id: string; name: string; url: string }[] = [
  {
    id: "api",
    name: "Backend API",
    url: process.env.STATUS_API_URL ?? "https://api.zunialab.com/health",
  },
  {
    id: "indexer",
    name: "Indexer",
    url: process.env.STATUS_INDEXER_URL ?? "https://indexer.zunialab.com/health",
  },
];

async function probe(url: string): Promise<Pick<StatusComponent, "status" | "latencyMs" | "detail">> {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return { status: "degraded", latencyMs, detail: `HTTP ${res.status}` };
    }
    return { status: latencyMs > 2_000 ? "degraded" : "operational", latencyMs };
  } catch (error) {
    return {
      status: "down",
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : "probe failed",
    };
  }
}

export async function collectStatus(): Promise<{
  updatedAt: string;
  overall: ComponentStatus;
  components: StatusComponent[];
}> {
  const checkedAt = new Date().toISOString();
  const components: StatusComponent[] = [];
  for (const endpoint of ENDPOINTS) {
    const result = await probe(endpoint.url);
    components.push({ ...endpoint, ...result, checkedAt });
  }
  const overall = components.some((c) => c.status === "down")
    ? "down"
    : components.some((c) => c.status === "degraded")
      ? "degraded"
      : "operational";
  return { updatedAt: checkedAt, overall, components };
}
