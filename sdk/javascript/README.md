# PintDown Discovery SDK (TypeScript)

Official client for the Public API v1.

## Install

```bash
cd sdk/javascript && npm install
```

## Example

```ts
import { PintDownClient } from "./src/client";

const client = new PintDownClient({
  baseUrl: "http://localhost:8000",
  apiToken: "pda_...",
});

const page = await client.backlinks.list({ page: 1, pageSize: 25 });
console.log(page.items);
```

Authentication uses `Authorization: Bearer pda_...`. Retries use exponential backoff on 429/5xx.
