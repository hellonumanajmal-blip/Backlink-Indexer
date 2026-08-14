export type ClientOptions = {
  baseUrl: string;
  apiToken: string;
  maxRetries?: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string,
  ) {
    super(message);
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class PintDownClient {
  constructor(private opts: ClientOptions) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const max = this.opts.maxRetries ?? 3;
    let attempt = 0;
    while (true) {
      const res = await fetch(`${this.opts.baseUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.opts.apiToken}`,
          "Content-Type": "application/json",
          ...(init.headers || {}),
        },
      });
      const requestId = res.headers.get("X-Request-Id") || undefined;
      if (res.ok) return (await res.json()) as T;
      if ((res.status === 429 || res.status >= 500) && attempt < max) {
        attempt += 1;
        await sleep(200 * 2 ** attempt);
        continue;
      }
      throw new ApiError(await res.text(), res.status, requestId);
    }
  }

  backlinks = {
    list: (q: { page?: number; pageSize?: number; platform?: string } = {}) => {
      const params = new URLSearchParams();
      if (q.page) params.set("page", String(q.page));
      if (q.pageSize) params.set("page_size", String(q.pageSize));
      if (q.platform) params.set("platform", q.platform);
      const qs = params.toString();
      return this.request<{ items: unknown[]; total: number }>(
        `/api/v1/backlinks${qs ? `?${qs}` : ""}`,
      );
    },
  };

  projects = {
    list: () => this.request<{ items: unknown[] }>("/api/v1/projects"),
  };
}
