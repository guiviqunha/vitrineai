import Studio from '@/components/studio';
import { requireAdminPage } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export default async function Page() { await requireAdminPage(); return <Studio />; }
