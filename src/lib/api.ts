import { WEB_URL } from './site';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Options = { token?: string | null; method?: string; body?: unknown };

// Calls the SwiftBill web API. Sends the sign-in token when we have one.
export async function api<T>(path: string, { token, method = 'GET', body }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${WEB_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach SwiftBill. Check your internet and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error || 'Something went wrong. Try again.', res.status);
  }
  return data as T;
}
