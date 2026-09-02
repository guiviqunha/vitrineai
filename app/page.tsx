import Catalog from '@/components/catalog';
import { catalog, settings } from '@/lib/server/catalog';
import { origin } from '@/lib/server/runtime';
export const dynamic = 'force-dynamic';
export async function generateMetadata() { const s = await settings(); return { metadataBase: new URL(origin()), title: `${s.name} · Catálogo`, description: s.description, openGraph: { title: `${s.name} · Catálogo`, description: s.description, images: ['/og.png'] }, twitter: { title: `${s.name} · Catálogo`, description: s.description, images: ['/og.png'] } }; }
export default async function Home() { return <Catalog {...await catalog()} />; }
