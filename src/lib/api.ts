import { QueryClient } from '@tanstack/react-query';
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false } },
});
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status,
      data.error?.message ?? 'მოთხოვნა ვერ შესრულდა. სცადეთ ხელახლა.',
    );
  return data as T;
}
export async function signIn(email: string, password: string) {
  await api('/api/auth/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  queryClient.clear();
}
export async function signOut() {
  await api('/api/auth/sign-out', { method: 'POST', body: '{}' });
  queryClient.clear();
}
