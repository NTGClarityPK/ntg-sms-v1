import type { AxiosError } from 'axios';

type ApiErrorBody = {
  error?: { message?: string; code?: string };
  message?: string;
};

export async function parseApiErrorMessage(err: unknown): Promise<{
  message?: string;
  code?: string;
  status?: number;
}> {
  const ax = err as AxiosError<ApiErrorBody | Blob>;
  const status = ax.response?.status;
  const data = ax.response?.data;

  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const json = JSON.parse(text) as ApiErrorBody;
      const raw = json?.error?.message ?? json?.message;
      const message = Array.isArray(raw) ? raw.join(', ') : typeof raw === 'string' ? raw : undefined;
      return { message, code: json?.error?.code, status };
    } catch {
      return { status };
    }
  }

  if (data && typeof data === 'object') {
    const raw = data.error?.message ?? data.message;
    const message = Array.isArray(raw) ? raw.join(', ') : typeof raw === 'string' ? raw : undefined;
    return { message, code: data.error?.code, status };
  }

  if (err instanceof Error && err.message) {
    return { message: err.message, status };
  }

  return { status };
}
