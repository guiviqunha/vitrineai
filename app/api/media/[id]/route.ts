import { isAdmin } from '@/lib/server/auth';
import { isPublicAsset } from '@/lib/server/catalog';
import { endpoint, HttpError } from '@/lib/server/http';
import { runtime } from '@/lib/server/runtime';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return endpoint(async () => {
    const { id } = await params; if (!/^[a-f0-9-]{36}$/.test(id)) throw new HttpError(404, 'Imagem não encontrada.');
    if (!await isPublicAsset(id) && !await isAdmin()) throw new HttpError(404, 'Imagem não encontrada.');
    const object = await runtime().BUCKET.get(id); if (!object) throw new HttpError(404, 'Imagem não encontrada.');
    return new Response(object.body, { headers: { 'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Content-Disposition': 'inline' } });
  });
}
