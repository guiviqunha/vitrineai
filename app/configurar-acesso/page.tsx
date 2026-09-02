import AccessForm from '@/components/access-form';
import { credential, isOwner } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configurar acesso · VitrineAI', robots: { index: false, follow: false } };
export default async function Page() {
  if (!await isOwner()) return <main className="grid min-h-screen place-items-center p-5"><section className="max-w-md rounded-3xl border border-border bg-card p-8"><h1 className="text-2xl font-extrabold">Confirme que o site é seu</h1><p className="my-5 text-sm leading-6 text-muted-foreground">Somente para criar ou recuperar sua senha, confirme a conta do ChatGPT proprietária deste site. Depois, o acesso ao painel será pela sua senha do VitrineAI. Clientes não precisam fazer login.</p><a className="block rounded-xl bg-primary p-3 text-center text-sm font-bold text-primary-foreground" href="/signin-with-chatgpt?return_to=%2Fconfigurar-acesso" target="_top">Confirmar minha conta de proprietário</a><a href="/entrar" className="mt-5 block text-center text-sm">Já tenho minha senha</a></section></main>;
  return <main className="grid min-h-screen place-items-center p-5 py-12"><AccessForm mode={await credential() ? 'recover' : 'setup'} /></main>;
}
