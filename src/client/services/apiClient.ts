import { auth } from '../../lib/firebase.ts';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const currentUser = auth.currentUser;
  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      'Une erreur est survenue lors de la communication avec le serveur.';
    const code = payload?.error?.code || 'API_ERROR';
    throw new ApiClientError(message, response.status, code, payload?.error?.details);
  }

  return payload as T;
}

export async function apiFetchBlob(path: string): Promise<Blob> {
  const currentUser = auth.currentUser;
  const headers = new Headers();

  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`/api/v1${path}`, { headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiClientError(
      payload?.error?.message || 'Téléchargement impossible.',
      response.status,
      payload?.error?.code || 'API_ERROR'
    );
  }
  return response.blob();
}

