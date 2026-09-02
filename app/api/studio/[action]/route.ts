import { requireAdmin } from '@/lib/server/auth';
import {
  assertOrigin,
  endpoint,
  HttpError,
  json,
  readJson,
} from '@/lib/server/http';
import {
  catalogDraft,
  checkConnection,
  generate,
  saveStudioProject,
  studioState,
} from '@/lib/server/studio';
export const dynamic = 'force-dynamic';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  return endpoint(async () => {
    await requireAdmin();
    if ((await params).action !== 'state')
      throw new HttpError(404, 'Não encontrado.');
    return json(await studioState());
  });
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  return endpoint(async () => {
    assertOrigin(request);
    await requireAdmin();
    const { action } = await params;
    if (action === 'connection') return json(await checkConnection());
    const body = await readJson(request);
    if (action === 'project') return json(await saveStudioProject(body));
    if (action === 'generate') return json(await generate(body));
    if (action === 'catalog') return json(await catalogDraft(body));
    throw new HttpError(404, 'Não encontrado.');
  });
}
