import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const settings = sqliteTable('catalog_settings', {
  id: integer('id').primaryKey(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(1),
});
export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    data: text('data').notNull(),
    published: integer('published').notNull().default(0),
    position: integer('position').notNull().default(0),
    revision: integer('revision').notNull().default(1),
  },
  (table) => [
    index('idx_products_published_position').on(
      table.published,
      table.position,
    ),
  ],
);
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  createdAt: integer('created_at').notNull(),
});
export const admin = sqliteTable('admin_credentials', {
  id: integer('id').primaryKey(),
  passwordHash: text('password_hash').notNull(),
  revision: integer('revision').notNull().default(1),
});
export const sessions = sqliteTable(
  'admin_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    expiresAt: integer('expires_at').notNull(),
    credentialRevision: integer('credential_revision').notNull(),
  },
  (table) => [index('idx_admin_sessions_expiry').on(table.expiresAt)],
);
export const attempts = sqliteTable('login_attempts', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export const studioProjects = sqliteTable(
  'studio_projects',
  {
    id: text('id').primaryKey(),
    data: text('data').notNull(),
    revision: integer('revision').notNull().default(1),
    updated: integer('updated').notNull(),
  },
  (t) => [index('idx_studio_projects_updated').on(t.updated)],
);
export const studioRuns = sqliteTable(
  'studio_runs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    kind: text('kind').notNull(),
    label: text('label').notNull(),
    status: text('status').notNull(),
    prompt: text('prompt').notNull(),
    output: text('output'),
    error: text('error'),
    created: integer('created').notNull(),
  },
  (t) => [index('idx_studio_runs_project_created').on(t.projectId, t.created)],
);
export const studioUsage = sqliteTable('studio_usage', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
});
