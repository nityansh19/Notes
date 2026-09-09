import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export function database() {
  return (env as unknown as { DB: D1Database }).DB;
}
export function bucket() {
  return (env as unknown as { FILES: R2Bucket }).FILES;
}
export async function identity(request: Request, write = false) {
  const user = await getChatGPTUser();
  if (!user) throw new Response('Sign in to continue.', { status: 401 });
  if (write) {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      throw new Response('Origin rejected.', { status: 403 });
  }
  return user;
}
export function errorResponse(error: unknown) {
  if (error instanceof Response) return error;
  if (String(error).includes('UNIQUE constraint failed: versions.id'))
    return Response.json(
      { error: 'This note changed in another tab. Reopen it before saving.' },
      { status: 409 },
    );
  console.error(error);
  return Response.json(
    { error: 'Something could not be saved. Please try again.' },
    { status: 500 },
  );
}
export const json = (data: unknown) =>
  Response.json(data, {
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
