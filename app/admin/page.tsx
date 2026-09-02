import CatalogAdmin from '@/components/catalog-admin';
import { catalog } from '@/lib/server/catalog';
import { requireAdminPage } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export default async function Page() { await requireAdminPage(); return <CatalogAdmin initial={await catalog(true)} />; }
