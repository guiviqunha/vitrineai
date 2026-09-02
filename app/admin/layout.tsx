import { requireAdminPage } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Layout({ children }: { children: React.ReactNode }) { await requireAdminPage(); return children; }
