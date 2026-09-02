import AccessForm from '@/components/access-form';
import { isAdmin } from '@/lib/server/auth';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entrar · VitrineAI', robots: { index: false, follow: false } };
export default async function Page() { if (await isAdmin()) redirect('/admin'); return <main className="grid min-h-screen place-items-center px-5 py-12"><AccessForm mode="login" /></main>; }
