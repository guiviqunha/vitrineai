import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db, origin, runtime } from './runtime';
import { HttpError } from './http';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const sessionName = () => origin().startsWith('https:') ? '__Host-vitrine_session' : 'vitrine_dev_session';
export async function credential() { return db().prepare('SELECT password_hash, revision FROM admin_credentials WHERE id = 1').first<{ password_hash: string; revision: number }>(); }
export async function isOwner() {
  const h = await headers(); const owner = runtime().OWNER_EMAIL || process.env.OWNER_EMAIL;
  return Boolean(owner && h.get('oai-authenticated-user-id') && h.get('oai-authenticated-user-email')?.toLowerCase() === owner.toLowerCase());
}
export async function isAdmin() {
  const token = (await cookies()).get(sessionName())?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  return Boolean(await db().prepare('SELECT s.token_hash FROM admin_sessions s JOIN admin_credentials c ON c.id = 1 AND c.revision = s.credential_revision WHERE s.token_hash = ? AND s.expires_at > ?').bind(digest(token), Date.now()).first());
}
export async function requireAdmin() { if (!await isAdmin()) throw new HttpError(401, 'Sua sessão terminou. Entre novamente.'); }
export async function requireAdminPage() { if (!await isAdmin()) redirect('/entrar'); }
export function validPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) throw new HttpError(400, 'Use uma senha de 12 a 128 caracteres.');
  return value;
}
function derive(password: string, salt: string): Promise<Buffer> {
  // OWASP scrypt profile: N=2^14, r=8, p=5. Native Workers crypto, never in the browser.
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 16384, r: 8, p: 5, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string) { const salt = randomBytes(32).toString('hex'); return `scrypt-v1$${salt}$${(await derive(password, salt)).toString('hex')}`; }
export async function verifyPassword(password: string, hash: string) {
  const [format, salt, value] = hash.split('$'); if (format !== 'scrypt-v1' || !salt || !value) return false;
  const expected = Buffer.from(value, 'hex'); const actual = await derive(password, salt); return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function startSession(revision: number) {
  const token = randomBytes(32).toString('hex'); const maxAge = 8 * 3600;
  await db().batch([
    db().prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(Date.now()),
    db().prepare('INSERT INTO admin_sessions (token_hash, expires_at, credential_revision) VALUES (?, ?, ?)').bind(digest(token), Date.now() + maxAge * 1000, revision),
  ]);
  (await cookies()).set(sessionName(), token, { httpOnly: true, secure: origin().startsWith('https:'), sameSite: 'strict', path: '/', maxAge });
}
export async function endSession() {
  const jar = await cookies(); const token = jar.get(sessionName())?.value;
  if (token) await db().prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(digest(token)).run();
  jar.set(sessionName(), '', { httpOnly: true, secure: origin().startsWith('https:'), sameSite: 'strict', path: '/', maxAge: 0 });
}
export async function throttle(request: Request) {
  const now = Date.now(); const bucket = Math.floor(now / 900000); const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  for (const [key, max] of [[`global:${bucket}`, 50], [`ip:${digest(ip)}:${bucket}`, 8]] as const) {
    const row = await db().prepare('INSERT INTO login_attempts (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(key, (bucket + 1) * 900000).first<{ count: number }>();
    if (!row || row.count > max) throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos e tente novamente.');
  }
  await db().prepare('DELETE FROM login_attempts WHERE expires_at < ?').bind(now).run();
}
