import { origin } from './runtime';
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function assertOrigin(request: Request) {
  if (request.headers.get('origin') !== origin() || request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'Origem não autorizada. Atualize a página e tente novamente.');
}
export async function readBytes(request: Request, limit: number) {
  if (Number(request.headers.get('content-length') || 0) > limit) throw new HttpError(413, 'Arquivo ou conteúdo muito grande.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Conteúdo não recebido.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new HttpError(413, 'Arquivo ou conteúdo muito grande.'); } chunks.push(value); }
  const all = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; } return all;
}
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Formato inválido.');
  try { const data = JSON.parse(new TextDecoder().decode(await readBytes(request, 32000))); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); return data; }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'Dados inválidos.'); }
}
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }); }
export async function endpoint(action: () => Promise<Response>) {
  try { return await action(); } catch (error) { return json({ error: error instanceof HttpError ? error.message : 'Não foi possível concluir. Tente novamente.' }, error instanceof HttpError ? error.status : 500); }
}
