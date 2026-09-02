'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Sparkles, Plus, Save, Download, X, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  checklistLabels,
  emptyStudioInput,
  shots,
  type StudioInput,
  type StudioProject,
  type StudioRun,
  type StudioState,
} from '@/lib/studio-types';

type Tab =
  | 'product'
  | 'images'
  | 'copy'
  | 'advice'
  | 'review'
  | 'projects'
  | 'api';
const tabs: [Tab, string][] = [
  ['product', 'Meu produto'],
  ['images', 'Imagens'],
  ['copy', 'Títulos e descrição'],
  ['advice', 'Dúvidas e melhorias'],
  ['review', 'Revisão do anúncio'],
  ['projects', 'Meus projetos'],
  ['api', 'API e custos'],
];
async function api<T>(action: string, body?: unknown): Promise<T> {
  const r = await fetch('/api/studio/' + action, {
    method: body === undefined ? 'GET' : 'POST',
    headers:
      body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const data = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok)
    throw new Error(
      data.error ||
        (r.status === 401
          ? 'Sua sessão expirou. Entre novamente.'
          : 'Não foi possível concluir. Atualize o histórico antes de repetir.'),
    );
  return data as T;
}
const message = (e: unknown) =>
  e instanceof Error ? e.message : 'Não foi possível concluir esta ação.';
function Card({ children }: { children: ReactNode }) {
  return <section className="admin-card space-y-5">{children}</section>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2 text-sm font-semibold">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Tick({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 text-sm leading-5">
      <Checkbox
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  );
}

export default function Studio() {
  const [tab, setTab] = useState<Tab>('product');
  const [input, setInput] = useState<StudioInput>(emptyStudioInput);
  const [project, setProject] = useState<StudioProject | null>(null);
  const [state, setState] = useState<StudioState | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [excluded, setExcluded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const locked = useRef(false),
    stop = useRef(false),
    file = useRef<HTMLInputElement>(null);
  const dirty =
    JSON.stringify(input) !==
    JSON.stringify(project?.input || emptyStudioInput());
  const plan = shots(input),
    activeShots = plan.filter((s) => !excluded.includes(s.key));
  const runs = state?.runs.filter((r) => r.projectId === project?.id) || [];
  async function refresh() {
    const next = await api<StudioState>('state');
    setState(next);
    return next;
  }
  useEffect(() => {
    void refresh().catch((e) => setError(message(e)));
  }, []);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty || busy) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, busy]);
  function change<K extends keyof StudioInput>(key: K, value: StudioInput[K]) {
    setInput((v) => ({ ...v, [key]: value }));
  }
  async function action(label: string, fn: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(label);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      locked.current = false;
      setBusy('');
    }
  }
  async function save() {
    const p = await api<StudioProject>('project', {
      id: project?.id || '',
      revision: project?.revision || 0,
      input,
    });
    setProject(p);
    setInput(p.input);
    setState((v) =>
      v
        ? { ...v, projects: [p, ...v.projects.filter((x) => x.id !== p.id)] }
        : v,
    );
    return p;
  }
  function open(p: StudioProject | null) {
    if (locked.current) return;
    if (dirty && !window.confirm('Descartar alterações ainda não salvas?'))
      return;
    setProject(p);
    setInput(p?.input || emptyStudioInput());
    setSelected([]);
    setExcluded([]);
    setConsent(false);
    setError('');
    setNotice('');
    setTab('product');
  }
  async function upload(f?: File) {
    if (!f) return;
    await action('Enviando foto', async () => {
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) ||
        f.size > 8 * 1024 * 1024
      )
        throw new Error('Envie JPG, PNG ou WEBP de até 8 MB.');
      const r = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': f.type },
        body: f,
      });
      const d = (await r.json()) as { id: string; error?: string };
      if (!r.ok) throw new Error(d.error || 'Falha no envio.');
      change('reference', d.id);
      setNotice('Foto enviada. Salve o projeto para guardar essa referência.');
    });
  }
  async function generate(kind: StudioRun['kind']) {
    if (locked.current) return;
    if (!state?.connection.configured) {
      setTab('api');
      setError('Configure a chave no servidor antes de gerar.');
      return;
    }
    if (!consent) {
      setError('Marque a confirmação de uso pago da API.');
      return;
    }
    if (kind === 'image' && !input.reference) {
      setTab('product');
      setError('Envie a foto original primeiro.');
      return;
    }
    const count = kind === 'image' ? activeShots.length : 1;
    if (!count) {
      setError('Selecione ao menos uma imagem no roteiro.');
      return;
    }
    if (
      !window.confirm(
        'Gerar ' +
          count +
          ' ' +
          (kind === 'image' ? 'imagem(ns)' : 'texto') +
          ' pela API paga? Os dados serão salvos e enviados à OpenAI. Novas tentativas podem gerar nova cobrança.',
      )
    )
      return;
    await action('Preparando geração', async () => {
      const p = await save();
      stop.current = false;
      let completed = 0;
      const queue =
        kind === 'image'
          ? activeShots
          : [
              {
                key: 'text',
                label:
                  kind === 'copy'
                    ? 'Títulos e descrição'
                    : 'Dúvidas e melhorias',
              },
            ];
      for (const shot of queue) {
        if (stop.current) break;
        setBusy(
          'Gerando ' + (completed + 1) + '/' + queue.length + ': ' + shot.label,
        );
        const r = await api<StudioRun>('generate', {
          id: crypto.randomUUID(),
          projectId: p.id,
          revision: p.revision,
          kind,
          shot: shot.key,
          consent: true,
        });
        setState((v) =>
          v ? { ...v, runs: [r, ...v.runs.filter((x) => x.id !== r.id)] } : v,
        );
        if (r.status !== 'done')
          throw new Error(
            r.error ||
              'Pedido em processamento. Atualize o histórico antes de repetir.',
          );
        completed++;
      }
      setNotice(
        completed +
          ' resultado(s) salvo(s). Revise antes de usar. ' +
          (stop.current ? 'A fila foi parada.' : ''),
      );
      await refresh();
    });
  }
  function download(r: StudioRun) {
    void action('Baixando', async () => {
      const response = await fetch('/api/media/' + r.imageId);
      if (!response.ok)
        throw new Error('Imagem indisponível ou sessão expirada.');
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vitrineai-' + r.id + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice('Download iniciado.');
    });
  }
  const textField = (
    key: keyof StudioInput,
    label: string,
    max: number,
    multi = false,
    placeholder = '',
  ) => (
    <Field label={label}>
      {multi ? (
        <Textarea
          value={String(input[key])}
          maxLength={max}
          placeholder={placeholder}
          onChange={(e) => change(key, e.target.value as never)}
        />
      ) : (
        <Input
          value={String(input[key])}
          maxLength={max}
          placeholder={placeholder}
          onChange={(e) => change(key, e.target.value as never)}
        />
      )}
    </Field>
  );
  const consentControl = (
    <Tick
      checked={consent}
      onChange={setConsent}
      disabled={!!busy}
      label="Autorizo o envio da foto e dos dados à OpenAI e entendo que a geração é cobrada na minha conta da API."
    />
  );
  const textResults = (kind: StudioRun['kind']) => (
    <div className="space-y-5">
      {runs
        .filter((r) => r.kind === kind)
        .map((r) => (
          <Card key={r.id}>
            <h3 className="font-bold">{r.label}</h3>
            <p className="text-xs text-muted-foreground">
              {new Date(r.created).toLocaleString('pt-BR')}
            </p>
            {r.text ? (
              <>
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7">
                  {r.text}
                </pre>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() =>
                    void action('Copiando', async () => {
                      try {
                        await navigator.clipboard.writeText(r.text!);
                        setNotice('Texto copiado.');
                      } catch {
                        throw new Error(
                          'O navegador bloqueou a cópia. Selecione o texto acima e copie manualmente.',
                        );
                      }
                    })
                  }
                >
                  Copiar texto
                </Button>
              </>
            ) : (
              <p className="text-sm">
                {r.error ||
                  'Pedido em processamento. Atualize o histórico. Não repita automaticamente.'}
              </p>
            )}
          </Card>
        ))}
    </div>
  );
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-5 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </span>
            <div>
              <p className="font-extrabold tracking-tight">VitrineAI</p>
              <p className="text-xs text-muted-foreground">
                Studio de marketplace
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => open(null)}
            >
              <Plus />
              Novo produto
            </Button>
            <Button
              disabled={!!busy}
              onClick={() =>
                void action('Salvando', async () => {
                  await save();
                  setNotice('Projeto salvo.');
                })
              }
            >
              <Save />
              Salvar projeto
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="border-b p-4 lg:border-r lg:border-b-0">
          <nav aria-label="Studio" className="flex flex-wrap gap-1 lg:flex-col">
            <a href="/" className="p-3 text-sm font-semibold text-primary">
              Catálogo público ↗
            </a>
            <a href="/admin" className="p-3 text-sm font-semibold text-primary">
              Configurações do catálogo
            </a>
            {tabs.map(([id, label]) => (
              <Button
                key={id}
                variant={tab === id ? 'secondary' : 'ghost'}
                className="justify-start px-3 py-5"
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => setTab(id)}
              >
                {label}
              </Button>
            ))}
          </nav>
          <p className="mt-6 hidden px-3 text-xs leading-5 text-muted-foreground lg:block">
            Projetos e resultados ficam privados. Só aparecem no catálogo quando
            você publica pelo painel.
          </p>
        </aside>
        <section className="min-w-0 space-y-6 px-5 py-7 lg:px-9">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              {project ? 'Projeto salvo' : 'Novo projeto'}
              {dirty ? ' · Alterações não salvas' : ''}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
              {tabs.find((t) => t[0] === tab)?.[1]}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {input.name || 'Comece pela foto e pelos dados reais do produto.'}
            </p>
          </div>
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              {error}{' '}
              {error.includes('sessão') && (
                <a className="underline" href="/entrar">
                  Entrar
                </a>
              )}
            </div>
          )}
          {notice && (
            <p
              role="status"
              className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm"
            >
              {notice}
            </p>
          )}
          {!!busy && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm"
            >
              <LoaderCircle className="size-4 animate-spin" />
              {busy}
              <span>Mantenha esta aba aberta.</span>
              {busy.startsWith('Gerando') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    stop.current = true;
                    setNotice(
                      'A fila vai parar depois do pedido atual. O pedido já enviado pode ser cobrado.',
                    );
                  }}
                >
                  Parar após este pedido
                </Button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() =>
                void action('Atualizando', async () => {
                  await refresh();
                  setNotice('Histórico atualizado.');
                })
              }
            >
              Atualizar histórico
            </Button>
            {state && (
              <span className="self-center text-xs text-muted-foreground">
                {state.connection.configured
                  ? 'Chave configurada no servidor'
                  : 'API ainda não configurada'}
              </span>
            )}
          </div>
          {tab === 'product' && (
            <fieldset
              disabled={!!busy}
              className="grid min-w-0 gap-5 xl:grid-cols-2"
            >
              <Card>
                <h2 className="text-lg font-bold">1. Foto de referência</h2>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void upload(e.dataTransfer.files[0]);
                  }}
                  className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5 text-center"
                >
                  {input.reference ? (
                    <img
                      src={'/api/media/' + input.reference}
                      alt="Foto original do produto"
                      className="mx-auto mb-4 h-64 w-full rounded-xl object-contain"
                    />
                  ) : (
                    <p className="my-12 text-sm text-muted-foreground">
                      Uma foto nítida é o ponto de partida.
                    </p>
                  )}
                  <Button
                    variant="outline"
                    disabled={!!busy}
                    onClick={() => file.current?.click()}
                  >
                    {input.reference ? 'Trocar foto' : 'Escolher foto'}
                  </Button>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Arraste ou escolha JPG, PNG ou WEBP de até 8 MB.
                  </p>
                  <input
                    ref={file}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    aria-label="Foto original"
                    onChange={(e) => {
                      void upload(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </div>
                {textField('name', 'Nome do produto *', 120)}
                {textField('category', 'Categoria', 100)}
                {textField('brand', 'Marca (se houver)', 120)}
                {textField('material', 'Material real', 400)}
                <div className="flex flex-wrap gap-5">
                  {['Mercado Livre', 'Shopee'].map((m) => (
                    <Tick
                      key={m}
                      label={m}
                      checked={input.marketplaces.includes(m)}
                      onChange={(v) =>
                        change(
                          'marketplaces',
                          v
                            ? [...input.marketplaces, m]
                            : input.marketplaces.filter((x) => x !== m),
                        )
                      }
                    />
                  ))}
                </div>
              </Card>
              <Card>
                <h2 className="text-lg font-bold">2. Cores e informações</h2>
                {input.colors.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="color"
                      aria-label={'Tom da cor ' + (i + 1)}
                      value={c.hex}
                      className="w-14 shrink-0 p-1"
                      onChange={(e) =>
                        change(
                          'colors',
                          input.colors.map((v, j) =>
                            j === i ? { ...v, hex: e.target.value } : v,
                          ),
                        )
                      }
                    />
                    <Input
                      aria-label={'Nome da cor ' + (i + 1)}
                      value={c.name}
                      maxLength={40}
                      onChange={(e) =>
                        change(
                          'colors',
                          input.colors.map((v, j) =>
                            j === i ? { ...v, name: e.target.value } : v,
                          ),
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={'Remover cor ' + (i + 1)}
                      disabled={input.colors.length === 1}
                      onClick={() =>
                        change(
                          'colors',
                          input.colors.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  disabled={input.colors.length >= 5}
                  onClick={() =>
                    change('colors', [
                      ...input.colors,
                      { name: 'Nova cor', hex: '#1f5fae' },
                    ])
                  }
                >
                  <Plus />
                  Adicionar cor (até 5)
                </Button>
                <div className="grid gap-3 sm:grid-cols-3">
                  {textField('width', 'Largura (cm)', 20)}
                  {textField('height', 'Altura (cm)', 20)}
                  {textField('depth', 'Profundidade (cm)', 20)}
                </div>
                {textField(
                  'capacity',
                  'Capacidade / peso (se comprovado)',
                  100,
                )}
                {textField(
                  'features',
                  'Características e benefícios comprovados',
                  2000,
                  true,
                )}
                {textField(
                  'preserve',
                  'Detalhes que não podem mudar',
                  1000,
                  true,
                )}
                {textField(
                  'objections',
                  'Dúvidas dos clientes e respostas comprovadas',
                  2000,
                  true,
                  'Ex.: O que vem incluso? Apenas o suporte, sem acessórios.',
                )}
                {textField(
                  'environments',
                  'Ambientes desejados',
                  1000,
                  true,
                  'Ex.: mesa de escritório, estante, fundo branco',
                )}
                <Button onClick={() => setTab('images')}>
                  Escolher imagens →
                </Button>
              </Card>
            </fieldset>
          )}
          {tab === 'images' && (
            <>
              <Card>
                <h2 className="text-lg font-bold">Monte seu pacote</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Tipo de pacote">
                    <NativeSelect
                      value={input.mode}
                      disabled={!!busy}
                      onChange={(e) => {
                        change('mode', e.target.value as StudioInput['mode']);
                        setExcluded([]);
                      }}
                    >
                      <NativeSelectOption value="pack">
                        Pacote completo · até 10 imagens
                      </NativeSelectOption>
                      <NativeSelectOption value="colors">
                        Uma foto por cor
                      </NativeSelectOption>
                      <NativeSelectOption value="collection">
                        Todas as cores juntas
                      </NativeSelectOption>
                    </NativeSelect>
                  </Field>
                  <Field label="Qualidade">
                    <NativeSelect
                      value={input.quality}
                      disabled={!!busy}
                      onChange={(e) =>
                        change(
                          'quality',
                          e.target.value as StudioInput['quality'],
                        )
                      }
                    >
                      <NativeSelectOption value="low">
                        Baixa · menor custo
                      </NativeSelectOption>
                      <NativeSelectOption value="medium">
                        Média
                      </NativeSelectOption>
                      <NativeSelectOption value="high">
                        Alta · maior custo
                      </NativeSelectOption>
                    </NativeSelect>
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {plan.map((s) => (
                    <Tick
                      key={s.key}
                      label={s.label}
                      checked={!excluded.includes(s.key)}
                      disabled={!!busy}
                      onChange={(v) =>
                        setExcluded((x) =>
                          v ? x.filter((k) => k !== s.key) : [...x, s.key],
                        )
                      }
                    />
                  ))}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Todas em 1024 × 1024. Para incluir medidas, preencha largura,
                  altura e profundidade. Para responder dúvidas, informe
                  respostas comprovadas. Sem esses dados, entram outras cenas. A
                  IA pode alterar detalhes: revise cada resultado.
                </p>
                {consentControl}
                <Button
                  disabled={!!busy || !state}
                  onClick={() => void generate('image')}
                >
                  <Sparkles />
                  Gerar {activeShots.length} imagens
                </Button>
              </Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">Resultados privados</h2>
                <Button
                  variant="outline"
                  disabled={!!busy || !selected.length}
                  onClick={() =>
                    void action('Criando rascunho', async () => {
                      const r = await api<{ created: boolean }>('catalog', {
                        projectId: project?.id,
                        runIds: selected,
                      });
                      setNotice(
                        r.created
                          ? 'Rascunho criado! Abra as configurações do catálogo para revisar e publicar.'
                          : 'Este projeto já tem um produto no catálogo. Abra o painel para editá-lo; nada foi sobrescrito.',
                      );
                    })
                  }
                >
                  Enviar {selected.length} como rascunho
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione até 5 fotos. Isso não publica nem altera um produto já
                existente.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {runs
                  .filter((r) => r.kind === 'image')
                  .map((r) => (
                    <Card key={r.id}>
                      <h3 className="font-semibold">{r.label}</h3>
                      {r.imageId ? (
                        <>
                          <img
                            src={'/api/media/' + r.imageId}
                            alt={r.label + ' — revisar fidelidade ao produto'}
                            className="aspect-square w-full rounded-xl bg-muted object-contain"
                          />
                          <Tick
                            label="Selecionar para catálogo"
                            disabled={
                              !!busy ||
                              (!selected.includes(r.id) && selected.length >= 5)
                            }
                            checked={selected.includes(r.id)}
                            onChange={(v) =>
                              setSelected((x) =>
                                v ? [...x, r.id] : x.filter((i) => i !== r.id),
                              )
                            }
                          />
                          <Button
                            variant="outline"
                            disabled={!!busy}
                            onClick={() => download(r)}
                          >
                            <Download />
                            Baixar PNG
                          </Button>
                        </>
                      ) : (
                        <p className="text-sm leading-6">
                          {r.error ||
                            'Pedido em processamento ou interrompido. Atualize o histórico antes de repetir: nova tentativa pode gerar cobrança.'}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created).toLocaleString('pt-BR')}
                      </p>
                    </Card>
                  ))}
              </div>
              {!runs.some((r) => r.kind === 'image') && (
                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Suas imagens geradas aparecerão aqui.
                </p>
              )}
            </>
          )}
          {(tab === 'copy' || tab === 'advice') && (
            <>
              <Card>
                <h2 className="text-lg font-bold">
                  {tab === 'copy'
                    ? 'Texto baseado no seu produto'
                    : 'Transforme dúvidas em informações úteis'}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {tab === 'copy'
                    ? 'Sugestões de títulos, descrição e justificativas para os marketplaces escolhidos. Confira limites e regras da categoria antes de publicar.'
                    : 'Possíveis dúvidas da categoria, ideias de imagens e perguntas para preencher os dados que faltam. Não é pesquisa ao vivo na internet nem promessa de vendas.'}
                </p>
                {consentControl}
                <Button
                  disabled={!!busy || !state}
                  onClick={() =>
                    void generate(tab === 'copy' ? 'copy' : 'advice')
                  }
                >
                  <Sparkles />
                  Gerar {tab === 'copy' ? 'títulos e descrição' : 'sugestões'}
                </Button>
              </Card>
              {textResults(tab === 'copy' ? 'copy' : 'advice')}
            </>
          )}
          {tab === 'review' && (
            <Card>
              <h2 className="text-lg font-bold">
                Revisão humana antes de publicar
              </h2>
              <p className="text-sm text-muted-foreground">
                {input.checks.filter((c) => checklistLabels.includes(c)).length}{' '}
                de {checklistLabels.length} itens conferidos. Isto não é
                previsão de vendas nem nota de conversão.
              </p>
              {checklistLabels.map((c) => (
                <Tick
                  key={c}
                  label={c}
                  checked={input.checks.includes(c)}
                  disabled={!!busy}
                  onChange={(v) =>
                    change(
                      'checks',
                      v
                        ? [...input.checks, c]
                        : input.checks.filter((x) => x !== c),
                    )
                  }
                />
              ))}
              <p className="text-sm leading-6">
                Use uma capa limpa para apresentar o produto; nas outras fotos,
                mostre detalhes, escala e contexto. O cenário não deve dar a
                entender que acessórios estão inclusos. Salve o projeto para
                guardar a revisão.
              </p>
            </Card>
          )}
          {tab === 'projects' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {state?.projects.map((p) => (
                <Card key={p.id}>
                  <div className="flex items-center gap-4">
                    {p.input.reference && (
                      <img
                        src={'/api/media/' + p.input.reference}
                        alt=""
                        className="size-20 rounded-xl object-contain"
                      />
                    )}
                    <div>
                      <h2 className="font-bold">{p.input.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.updated).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    disabled={!!busy}
                    onClick={() => open(p)}
                  >
                    Abrir projeto
                  </Button>
                </Card>
              ))}
              {state && !state.projects.length && (
                <p className="text-sm text-muted-foreground">
                  Nenhum projeto salvo. Preencha Meu produto e clique em Salvar
                  projeto.
                </p>
              )}
            </div>
          )}
          {tab === 'api' && (
            <Card>
              <h2 className="text-lg font-bold">Conexão segura com a OpenAI</h2>
              <p className="text-sm">
                {state?.connection.configured
                  ? 'Uma chave está configurada no servidor. Teste abaixo se os modelos estão acessíveis.'
                  : 'Falta configurar OPENAI_API_KEY como segredo da hospedagem. Nunca coloque a chave no código público ou no chat.'}
              </p>
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() =>
                  void action('Consultando conexão', async () => {
                    const r = await api<{ message: string }>('connection', {});
                    setNotice(r.message);
                    await refresh();
                  })
                }
              >
                Testar conexão (sem gerar)
              </Button>
              {state && (
                <p className="text-sm leading-7">
                  Imagens: {state.connection.imageModel} · Textos:{' '}
                  {state.connection.textModel}
                  <br />
                  Tentativas hoje (UTC): {state.connection.imagesToday}/
                  {state.connection.dailyImageLimit} imagens e{' '}
                  {state.connection.textsToday}/
                  {state.connection.dailyTextLimit} textos.
                </p>
              )}
              <p className="text-sm leading-6 text-muted-foreground">
                Estes limites são proteções do site, não créditos gratuitos ou
                saldo. Cada geração depende do acesso, saldo e limites da sua
                conta. Não fazemos novas tentativas automaticamente. Um pedido
                interrompido pode ter sido processado e cobrado pela API.
              </p>
              <a
                href="https://developers.openai.com/api/docs/pricing"
                target="_blank"
                rel="noreferrer"
                className="block text-sm font-semibold text-primary underline"
              >
                Preços oficiais ↗
              </a>
              <a
                href="https://platform.openai.com/usage"
                target="_blank"
                rel="noreferrer"
                className="block text-sm font-semibold text-primary underline"
              >
                Uso da conta ↗
              </a>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
