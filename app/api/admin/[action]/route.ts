import { credential, hashPassword, requireAdmin, startSession, throttle, validPassword, verifyPassword } from '@/lib/server/auth';
import { catalog, saveProduct, saveSettings } from '@/lib/server/catalog';
import { assertOrigin, endpoint, HttpError, json, readBytes, readJson } from '@/lib/server/http';
import { db, runtime } from '@/lib/server/runtime';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ action: string }> }) {
  return endpoint(async () => { await requireAdmin(); if ((await params).action !== 'catalog') throw new HttpError(404, 'Não encontrado.'); return json(await catalog(true)); });
}
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  return endpoint(async () => {
    assertOrigin(request); await requireAdmin(); const { action } = await params;
    if (action === 'upload') {
      const bytes = await readBytes(request, 8 * 1024 * 1024); let mime = '';
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mime = 'image/jpeg';
      if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) mime = 'image/png';
      if (new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP') mime = 'image/webp';
      if (!mime || bytes.length < 16) throw new HttpError(400, 'Envie uma imagem JPG, PNG ou WEBP válida, de até 8 MB.');
      const id = crypto.randomUUID(); await runtime().BUCKET.put(id, bytes, { httpMetadata: { contentType: mime } });
      try { await db().prepare('INSERT INTO assets (id, mime, size, created_at) VALUES (?, ?, ?, ?)').bind(id, mime, bytes.length, Date.now()).run(); }
      catch (error) { await runtime().BUCKET.delete(id); throw error; }
      return json({ id }, 201);
    }
    const body = await readJson(request);
    if (action === 'product') { await saveProduct(body); return json(await catalog(true)); }
    if (action === 'settings') { await saveSettings(body); return json(await catalog(true)); }
    if (action === 'password') {
      await throttle(request); const existing = await credential(); const old = validPassword(body.currentPassword); const next = validPassword(body.password);
      if (!existing || !await verifyPassword(old, existing.password_hash)) throw new HttpError(401, 'Senha atual incorreta.');
      const result = await db().prepare('UPDATE admin_credentials SET password_hash = ?, revision = revision + 1 WHERE id = 1 AND revision = ?').bind(await hashPassword(next), existing.revision).run();
      if (!result.meta.changes) throw new HttpError(409, 'A senha foi alterada. Entre novamente.');
      await db().prepare('DELETE FROM admin_sessions').run(); await startSession(existing.revision + 1); return json({ ok: true });
    }
    throw new HttpError(404, 'Não encontrado.');
  });
}
