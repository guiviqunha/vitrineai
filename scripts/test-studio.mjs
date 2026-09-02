import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(
  readFileSync(new URL('../lib/studio-types.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { emptyStudioInput, shots, imagePrompt } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
let checks = 0;
const check = (v, label) => {
  assert(v, label);
  checks++;
  console.log('OK ' + label);
};
let input = emptyStudioInput();
input.name = 'Suporte de teste local';
check(shots(input).length === 10, 'pack contains 10 shots');
check(
  !shots(input).some((s) => s.key === 'dimensions' || s.key === 'objections'),
  'missing facts do not produce measurements or claims',
);
input.colors = [
  { name: 'Preto', hex: '#000000' },
  { name: 'Azul', hex: '#0000ff' },
];
input.width = '10';
input.height = '20';
input.depth = '5';
input.objections = 'Não acompanha acessórios.';
check(
  shots(input).some((s) => s.key === 'dimensions') &&
    shots(input).some((s) => s.key === 'objections'),
  'verified data enables fact-specific images',
);
check(
  imagePrompt(input, shots(input)[0]).includes('Não acompanha acessórios.'),
  'prompt preserves seller facts',
);
check(shots({ ...input, mode: 'colors' }).length === 2, 'one shot per color');
check(
  shots({ ...input, mode: 'collection' }).length === 1,
  'one collection image',
);
const base = process.env.TEST_ORIGIN || 'http://localhost:3000';
assert(
  ['localhost', '127.0.0.1'].includes(new URL(base).hostname),
  'Tests must be local',
);
const get = (path, cookie = '') =>
  fetch(base + path, { headers: { cookie }, redirect: 'manual' });
const post = (path, body, cookie = '', origin = base) =>
  fetch(base + path, {
    method: 'POST',
    headers: { cookie, origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
check(
  (await get('/api/studio/state')).status === 401,
  'anonymous cannot read projects',
);
for (const a of ['project', 'generate', 'catalog', 'connection'])
  check(
    (await post('/api/studio/' + a, {})).status === 401,
    'anonymous blocked: ' + a,
  );
const password = randomBytes(24).toString('hex');
let login = await post('/api/auth/setup', { password }, '__sites_local_auth=1');
if (login.status === 409)
  login = await post('/api/auth/recover', { password }, '__sites_local_auth=1');
check(login.status === 200, 'local administrator authorized');
const cookie = login.headers.get('set-cookie').split(';')[0];
check(
  (await post('/api/studio/project', {}, cookie, 'https://evil.example'))
    .status === 403,
  'cross-origin writes blocked',
);
check(
  (
    await post(
      '/api/studio/project',
      { id: '', revision: 0, input: { ...input, name: '' } },
      cookie,
    )
  ).status === 400,
  'empty name rejected',
);
check(
  (
    await post(
      '/api/studio/project',
      { id: '', revision: 0, input: { ...input, colors: [] } },
      cookie,
    )
  ).status === 400,
  'empty colors rejected',
);
check(
  (
    await post(
      '/api/studio/project',
      { id: '', revision: 0, input: { ...input, width: 'abc' } },
      cookie,
    )
  ).status === 400,
  'non-numeric measurement rejected',
);
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
const uploaded = await fetch(base + '/api/admin/upload', {
  method: 'POST',
  headers: { cookie, origin: base, 'Content-Type': 'image/png' },
  body: png,
});
check(uploaded.status === 201, 'reference uploaded');
input.reference = (await uploaded.json()).id;
check(
  (await get('/api/media/' + input.reference)).status === 404,
  'reference remains private',
);
const saved = await post(
  '/api/studio/project',
  { id: '', revision: 0, input },
  cookie,
);
check(saved.status === 200, 'studio project saved');
let project = await saved.json();
const again = await get('/api/studio/state', cookie);
check(again.status === 200, 'state reloads');
const state = await again.json();
check(
  state.projects.some(
    (p) => p.id === project.id && p.input.reference === input.reference,
  ),
  'project and reference persisted',
);
check(
  typeof state.connection.configured === 'boolean' &&
    !JSON.stringify(state).includes('sk-proj-'),
  'connection status does not expose key',
);
const updated = await post(
  '/api/studio/project',
  {
    id: project.id,
    revision: project.revision,
    input: { ...input, name: 'Alteração local de teste' },
  },
  cookie,
);
check(updated.status === 200, 'project update works');
check(
  (
    await post(
      '/api/studio/project',
      { id: project.id, revision: project.revision, input },
      cookie,
    )
  ).status === 409,
  'stale updates rejected',
);
project = await updated.json();
const noConsent = await post(
  '/api/studio/generate',
  {
    id: randomUUID(),
    projectId: project.id,
    revision: project.revision,
    kind: 'image',
    shot: 'cover',
    consent: false,
  },
  cookie,
);
check([400, 503].includes(noConsent.status), 'no consent never generates');
check(
  (
    await post(
      '/api/studio/catalog',
      { projectId: project.id, runIds: [randomUUID()] },
      cookie,
    )
  ).status === 400,
  'cannot publish nonexistent results',
);
check(
  (await get('/admin/studio', cookie)).status === 200,
  'studio renders behind password',
);
const connection = await post('/api/studio/connection', {}, cookie);
console.log('Connection check (no paid generation): HTTP ' + connection.status);
check(
  (await post('/api/auth/logout', {}, cookie)).status === 200,
  'test session logged out',
);
console.log(
  'PASS ' +
    checks +
    ' checks. No paid OpenAI generation. Only local test records created.',
);
