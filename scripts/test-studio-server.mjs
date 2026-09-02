import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = (s) =>
  ts.transpileModule(s, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
const load = (s) =>
  import(
    'data:text/javascript;base64,' + Buffer.from(compile(s)).toString('base64')
  );
const types = await load(
  readFileSync(new URL('../lib/studio-types.ts', import.meta.url), 'utf8'),
);
const sql = new DatabaseSync(':memory:');
for (const name of [
  '0000_known_young_avengers.sql',
  '0001_flashy_agent_brand.sql',
])
  sql.exec(
    readFileSync(new URL('../drizzle/' + name, import.meta.url), 'utf8'),
  );
const d1 = {
  prepare(query) {
    let values = [];
    return {
      bind(...v) {
        values = v;
        return this;
      },
      first() {
        return sql.prepare(query).get(...values) || null;
      },
      all() {
        return { results: sql.prepare(query).all(...values) };
      },
      run() {
        return {
          meta: { changes: Number(sql.prepare(query).run(...values).changes) },
        };
      },
    };
  },
};
const files = new Map();
const bucket = {
  async put(id, data, { httpMetadata }) {
    files.set(id, {
      arrayBuffer: async () => new Uint8Array(data).buffer,
      httpMetadata,
    });
  },
  async get(id) {
    return files.get(id) || null;
  },
};
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const env = {
  DB: d1,
  BUCKET: bucket,
  OPENAI_API_KEY: 'test-placeholder-not-a-real-key',
};
globalThis.__studioTest = {
  db: () => d1,
  runtime: () => env,
  HttpError,
  ...types,
};
let source = readFileSync(
  new URL('../lib/server/studio.ts', import.meta.url),
  'utf8',
).replace(/^import .*;\r?\n/gm, '');
source =
  'const {db,runtime,HttpError,imagePrompt,shots}=globalThis.__studioTest;\n' +
  source;
const studio = await load(source);
let checks = 0,
  calls = 0;
const check = (v, label) => {
  assert(v, label);
  checks++;
  console.log('OK ' + label);
};
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
const ref = crypto.randomUUID();
await bucket.put(ref, png, { httpMetadata: { contentType: 'image/png' } });
sql
  .prepare('INSERT INTO assets VALUES (?,?,?,?)')
  .run(ref, 'image/png', png.length, Date.now());
const input = {
  ...types.emptyStudioInput(),
  name: 'Teste em memória',
  reference: ref,
};
const project = await studio.saveStudioProject({ id: '', revision: 0, input });
globalThis.fetch = async (url, options) => {
  calls++;
  check(url.endsWith('/images/edits'), 'correct image endpoint');
  check(options.body.get('model') === 'gpt-image-2', 'model and form wired');
  check(options.body.get('image[]') instanceof Blob, 'reference is uploaded');
  return Response.json({ data: [{ b64_json: png.toString('base64') }] });
};
const request = {
  id: crypto.randomUUID(),
  projectId: project.id,
  revision: project.revision,
  kind: 'image',
  shot: 'cover',
  consent: true,
};
let result = await studio.generate(request);
check(
  result.status === 'done' && files.has(result.imageId),
  'generated image persisted privately',
);
const repeat = await studio.generate(request);
check(
  repeat.imageId === result.imageId && calls === 1,
  'repeated ID does not spend again',
);
await assert.rejects(
  studio.generate({ ...request, kind: 'copy' }),
  (e) => e.status === 409,
);
checks++;
let draft = await studio.catalogDraft({
  projectId: project.id,
  runIds: [result.id],
});
check(
  draft.created &&
    sql.prepare('SELECT published FROM products WHERE id=?').get(draft.id)
      .published === 0,
  'catalog import creates only a draft',
);
check(
  !(await studio.catalogDraft({ projectId: project.id, runIds: [result.id] }))
    .created,
  'catalog import never overwrites prior edits',
);
globalThis.fetch = async () => {
  calls++;
  return Response.json({
    status: 'completed',
    output: [
      {
        type: 'message',
        content: [{ type: 'output_text', text: 'Texto de teste' }],
      },
    ],
  });
};
result = await studio.generate({
  ...request,
  id: crypto.randomUUID(),
  kind: 'copy',
});
check(
  result.text === 'Texto de teste' && result.status === 'done',
  'Responses text persisted',
);
globalThis.fetch = async () => {
  calls++;
  throw new Error('simulated connection interruption');
};
const failedRequest = { ...request, id: crypto.randomUUID() };
result = await studio.generate(failedRequest);
check(
  result.status === 'uncertain',
  'sent interrupted request remains uncertain',
);
const before = calls;
await studio.generate(failedRequest);
check(calls === before, 'uncertain request never auto-retries');
sql
  .prepare(
    'INSERT INTO studio_usage (key,count) VALUES (?,50) ON CONFLICT(key) DO UPDATE SET count=50',
  )
  .run('image:' + new Date().toISOString().slice(0, 10));
result = await studio.generate({ ...request, id: crypto.randomUUID() });
check(
  result.status === 'failed' && calls === before,
  'daily quota blocks upstream calls',
);
env.OPENAI_API_KEY = '';
await assert.rejects(
  studio.generate({ ...request, id: crypto.randomUUID() }),
  (e) => e.status === 503,
);
checks++;
sql.close();
delete globalThis.__studioTest;
console.log(
  'PASS ' + checks + ' isolated checks. No real API requests or credentials.',
);
