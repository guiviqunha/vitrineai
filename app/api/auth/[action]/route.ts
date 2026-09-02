import { credential, endSession, hashPassword, isOwner, startSession, throttle, validPassword, verifyPassword } from '@/lib/server/auth';
import { assertOrigin, endpoint, HttpError, json, readJson } from '@/lib/server/http';
import { db } from '@/lib/server/runtime';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  return endpoint(async () => {
    assertOrigin(request); const { action } = await params;
    if (action === 'logout') { await endSession(); return json({ ok: true }); }
    if (!['login', 'setup', 'recover'].includes(action)) throw new HttpError(404, 'Não encontrado.');
    if (action !== 'login' && !await isOwner()) throw new HttpError(403, 'Apenas o proprietário pode definir o primeiro acesso ou recuperar a senha.');
    await throttle(request); const body = await readJson(request); const password = validPassword(body.password); const existing = await credential();
    if (action === 'login') {
      if (!existing || !await verifyPassword(password, existing.password_hash)) throw new HttpError(401, 'Senha incorreta ou acesso ainda não configurado.');
      await startSession(existing.revision);
    } else if (action === 'setup') {
      if (existing) throw new HttpError(409, 'A senha já foi definida. Use a tela de entrada.');
      const hashed = await hashPassword(password);
      const result = await db().prepare('INSERT OR IGNORE INTO admin_credentials (id, password_hash, revision) VALUES (1, ?, 1)').bind(hashed).run();
      if (!result.meta.changes) throw new HttpError(409, 'A senha já foi definida. Use a tela de entrada.');
      await startSession(1);
    } else {
      if (!existing) throw new HttpError(409, 'Configure o primeiro acesso.');
      const hashed = await hashPassword(password);
      const result = await db().prepare('UPDATE admin_credentials SET password_hash = ?, revision = revision + 1 WHERE id = 1 AND revision = ?').bind(hashed, existing.revision).run();
      if (!result.meta.changes) throw new HttpError(409, 'A senha foi alterada. Atualize a página.');
      await db().prepare('DELETE FROM admin_sessions').run(); await startSession(existing.revision + 1);
    }
    return json({ ok: true });
  });
}
