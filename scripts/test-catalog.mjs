import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
const base = process.env.TEST_ORIGIN || 'http://localhost:3000';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname), 'Integration test is local-only');
const owner = '__sites_local_auth=1';
const password = randomBytes(24).toString('hex');
const nextPassword = randomBytes(24).toString('hex');
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; console.log(`OK ${message}`); };
async function get(path, cookie = '') { return fetch(base + path, { headers: { cookie }, redirect: 'manual' }); }
async function post(path, body, cookie = '', origin = base) { return fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', origin, cookie }, body: JSON.stringify(body), redirect: 'manual' }); }
function session(r) { return r.headers.get('set-cookie')?.split(';')[0] || ''; }
check((await get('/')).status === 200, 'catalog opens anonymously');
for (const path of ['/admin', '/admin/studio']) {
  const r = await get(path); check(r.status >= 300 && r.status < 400 && r.headers.get('location')?.includes('/entrar'), `${path} blocks anonymous access`);
}
check((await get('/api/admin/catalog')).status === 401, 'admin data rejects anonymous access');
check((await get('/api/admin/catalog', owner)).status === 401, 'owner identity alone does not bypass password');
check((await post('/api/admin/settings', {})).status === 401, 'anonymous writes rejected');
check((await post('/api/auth/setup', { password })).status === 403, 'anonymous cannot claim first password');
const forged = await fetch(base + '/api/auth/setup', { method: 'POST', headers: { origin: base, 'Content-Type': 'application/json', 'oai-authenticated-user-id': 'local_seedy', 'oai-authenticated-user-email': 'seedy@sites.test' }, body: JSON.stringify({ password }) });
check(forged.status === 403, 'platform strips forged owner headers');
check((await post('/api/auth/setup', { password }, owner, 'https://evil.example')).status === 403, 'cross-site password setup rejected');
let setup = await post('/api/auth/setup', { password }, owner);
if (setup.status === 409) setup = await post('/api/auth/recover', { password }, owner);
check(setup.status === 200, `owner can configure password (${setup.status})`);
let cookie = session(setup); check(cookie.includes('vitrine_dev_session='), 'session cookie issued');
check(/httponly/i.test(setup.headers.get('set-cookie')) && /samesite=strict/i.test(setup.headers.get('set-cookie')), 'HttpOnly and SameSite session flags');
check((await get('/admin', cookie)).status === 200, 'password session opens admin');
check((await get('/admin/studio', cookie)).status === 200, 'password session opens studio');
check((await post('/api/admin/settings', {}, cookie, 'https://evil.example')).status === 403, 'authenticated cross-site write rejected');
const original = await (await get('/api/admin/catalog', cookie)).json();
const invalidImage = await fetch(base + '/api/admin/upload', { method: 'POST', headers: { origin: base, cookie, 'Content-Type': 'image/svg+xml' }, body: '<svg onload="alert(1)"></svg>' });
check(invalidImage.status === 400, 'SVG upload rejected');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const upload = await fetch(base + '/api/admin/upload', { method: 'POST', headers: { origin: base, cookie, 'Content-Type': 'image/png' }, body: png });
check(upload.status === 201, 'photo saved to storage'); const { id: image } = await upload.json();
check((await get('/api/media/' + image)).status === 404, 'unpublished photo is private');
check((await get('/api/media/' + image, cookie)).status === 200, 'administrator can preview unpublished photo');
const name = 'Teste local ' + Date.now();
const draft = { id: '', name, category: 'Categoria teste', description: 'Descrição local de verificação', price: 1234567, dimensions: '10 × 20 cm', colors: 'Azul', images: [image], published: false, position: 9999, revision: 0 };
let save = await post('/api/admin/product', draft, cookie); check(save.status === 200, 'draft saved');
let data = await save.json(); let product = data.products.find(p => p.name === name);
check((await get('/produto/' + product.id)).status === 404, 'draft detail is not public');
save = await post('/api/admin/product', { ...product, published: true }, cookie); check(save.status === 200, 'product published'); data = await save.json(); product = data.products.find(p => p.id === product.id);
let detail = await get('/produto/' + product.id); let html = await detail.text();
check(detail.status === 200 && html.includes(name) && html.includes('Descrição local de verificação'), 'public product persists with correct name and description');
check(html.includes('og:image') && html.includes('/api/media/' + image) && html.includes('twitter:title'), 'product-specific social preview uses product photo');
check((await get('/api/media/' + image)).status === 200, 'published photo becomes public');
save = await post('/api/admin/product', { ...product, revision: product.revision - 1 }, cookie); check(save.status === 409, 'stale edits cannot overwrite newer product');
save = await post('/api/admin/settings', { ...data.settings, name: 'Loja de teste', showPrices: false }, cookie); check(save.status === 200, 'catalog settings saved'); data = await save.json();
html = await (await get('/produto/' + product.id)).text(); check(!html.includes('1234567') && html.includes('Loja de teste'), 'hidden price removed from public response, saved brand rendered');
const second = { ...draft, name: name + ' segundo', published: true, price: null };
save = await post('/api/admin/product', second, cookie); check(save.status === 200, 'second representative product saved'); data = await save.json(); const secondProduct = data.products.find(p => p.name === second.name);
html = await (await get('/produto/' + secondProduct.id)).text(); check(html.includes(second.name) && html.includes('og:title') && html.includes('/api/media/' + image), 'second product metadata matches its record');
for (const p of [product, secondProduct]) { const r = await post('/api/admin/product', { ...p, published: false }, cookie); check(r.status === 200, 'test product returned to draft'); }
check((await get('/api/media/' + image)).status === 404, 'unpublishing removes public access to photo');
save = await post('/api/admin/settings', { ...original.settings, revision: data.settings.revision }, cookie); check(save.status === 200, 'original catalog appearance restored');
const bad = await post('/api/auth/login', { password: 'this-is-not-the-password' }); check(bad.status === 401, 'wrong password rejected');
const login = await post('/api/auth/login', { password }); check(login.status === 200, 'password login works without ChatGPT identity'); const secondSession = session(login);
save = await post('/api/admin/password', { currentPassword: password, password: nextPassword }, cookie); check(save.status === 200, 'password can be changed'); cookie = session(save);
check((await get('/api/admin/catalog', secondSession)).status === 401, 'changing password revokes old sessions');
check((await get('/api/admin/catalog', cookie)).status === 200, 'new session remains valid');
check((await post('/api/auth/logout', {}, cookie)).status === 200, 'logout succeeds');
check((await get('/api/admin/catalog', cookie)).status === 401, 'logout revokes session server-side');
let blocked = false; for (let i = 0; i < 9; i++) { const r = await post('/api/auth/login', { password: 'this-is-not-the-password' }); if (r.status === 429) { blocked = true; break; } }
check(blocked, 'repeated login attempts are rate limited');
console.log(`PASS: ${checks} checks. No production data touched.`);
