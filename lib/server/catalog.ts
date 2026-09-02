import { db } from './runtime';
import { defaultSettings, type Product, type CatalogSettings } from '../catalog-types';
import { HttpError } from './http';
type Row = { id: string; data: string; revision: number; published: number; position: number };
const productFromRow = (row: Row): Product => ({ ...JSON.parse(row.data), id: row.id, published: Boolean(row.published), position: row.position, revision: row.revision });
export async function settings(): Promise<CatalogSettings> { const row = await db().prepare('SELECT data, revision FROM catalog_settings WHERE id = 1').first<{ data: string; revision: number }>(); return row ? { ...defaultSettings, ...JSON.parse(row.data), revision: row.revision } : { ...defaultSettings }; }
export async function catalog(admin = false) {
  const config = await settings();
  const rows = await db().prepare(admin ? 'SELECT * FROM products ORDER BY position, id LIMIT 500' : 'SELECT * FROM products WHERE published = 1 ORDER BY position, id LIMIT 500').all<Row>();
  return { settings: config, products: rows.results.map(productFromRow).map(p => !admin && !config.showPrices ? { ...p, price: null } : p) };
}
export async function publicProduct(id: string) {
  const row = await db().prepare('SELECT * FROM products WHERE id = ? AND published = 1').bind(id).first<Row>();
  if (!row) return null; const config = await settings(); const product = productFromRow(row);
  if (!config.showPrices) product.price = null; return { product, settings: config };
}
function field(value: unknown, max: number, required = false) { if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new HttpError(400, 'Revise os campos e seus limites.'); return value.trim(); }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
async function checkImages(value: unknown, max: number): Promise<string[]> {
  if (!Array.isArray(value) || value.length > max || value.some(id => typeof id !== 'string' || !uuid.test(id))) throw new HttpError(400, 'Fotos inválidas.');
  for (const id of value) if (!await db().prepare('SELECT id FROM assets WHERE id = ?').bind(id).first()) throw new HttpError(400, 'Envie a foto novamente.');
  return [...new Set(value)];
}
export async function saveProduct(body: Record<string, unknown>) {
  const id = body.id === '' ? crypto.randomUUID() : field(body.id, 36, true); if (!uuid.test(id)) throw new HttpError(400, 'Produto inválido.');
  if (!Number.isInteger(body.revision) || Number(body.revision) < 0 || typeof body.published !== 'boolean' || !Number.isInteger(body.position) || Number(body.position) < 0 || Number(body.position) > 9999) throw new HttpError(400, 'Dados inválidos.');
  if (body.price !== null && (!Number.isSafeInteger(body.price) || Number(body.price) < 0 || Number(body.price) > 999999999)) throw new HttpError(400, 'Preço inválido.');
  const images = await checkImages(body.images, 5);
  if (body.published && images.length === 0) throw new HttpError(400, 'Adicione pelo menos uma foto para publicar o produto.');
  const data = JSON.stringify({ name: field(body.name, 120, true), category: field(body.category, 80), description: field(body.description, 5000), dimensions: field(body.dimensions, 300), colors: field(body.colors, 300), price: body.price, images });
  if (body.id === '') {
    const count = await db().prepare('SELECT count(*) AS n FROM products').first<{ n: number }>(); if (count && count.n >= 500) throw new HttpError(400, 'Limite de 500 produtos atingido.');
    await db().prepare('INSERT INTO products (id, data, published, position, revision) VALUES (?, ?, ?, ?, 1)').bind(id, data, body.published ? 1 : 0, body.position).run();
  } else {
    const result = await db().prepare('UPDATE products SET data = ?, published = ?, position = ?, revision = revision + 1 WHERE id = ? AND revision = ?').bind(data, body.published ? 1 : 0, body.position, id, body.revision).run();
    if (!result.meta.changes) throw new HttpError(409, 'Este produto foi alterado em outra aba. Atualize a lista antes de editar.');
  }
  return id;
}
export async function saveSettings(body: Record<string, unknown>) {
  if (!/^#[0-9a-f]{6}$/i.test(String(body.accent)) || !/^\d{10,15}$|^$/.test(String(body.whatsapp)) || typeof body.showPrices !== 'boolean' || !Number.isInteger(body.revision)) throw new HttpError(400, 'Revise a cor, o WhatsApp e as opções.');
  const logo = field(body.logo, 36); const cover = field(body.cover, 36); await checkImages([logo, cover].filter(Boolean), 2);
  const data = JSON.stringify({ name: field(body.name, 80, true), headline: field(body.headline, 140, true), description: field(body.description, 1000), whatsapp: body.whatsapp, accent: body.accent, logo, cover, showPrices: body.showPrices });
  if (body.revision === 0) {
    const r = await db().prepare('INSERT OR IGNORE INTO catalog_settings (id, data, revision) VALUES (1, ?, 1)').bind(data).run(); if (!r.meta.changes) throw new HttpError(409, 'Configurações alteradas em outra aba. Atualize a página.');
  } else {
    const r = await db().prepare('UPDATE catalog_settings SET data = ?, revision = revision + 1 WHERE id = 1 AND revision = ?').bind(data, body.revision).run(); if (!r.meta.changes) throw new HttpError(409, 'Configurações alteradas em outra aba. Atualize a página.');
  }
}
export async function isPublicAsset(id: string) {
  return Boolean(await db().prepare("SELECT id FROM products WHERE published = 1 AND EXISTS (SELECT 1 FROM json_each(products.data, '$.images') WHERE value = ?) LIMIT 1").bind(id).first()) || Boolean(await db().prepare("SELECT id FROM catalog_settings WHERE json_extract(data, '$.logo') = ? OR json_extract(data, '$.cover') = ?").bind(id, id).first());
}
