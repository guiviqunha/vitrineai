import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetail from '@/components/product-detail';
import { publicProduct } from '@/lib/server/catalog';
import { imageUrl } from '@/lib/catalog-types';
import { origin } from '@/lib/server/runtime';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const data = await publicProduct((await params).id);
  if (!data) return { title: 'Produto não encontrado', robots: { index: false }, openGraph: { images: [] }, twitter: { images: [] } };
  const { product, settings } = data; const title = `${product.name} · ${settings.name}`; const description = product.description.slice(0, 160);
  const images = product.images[0] ? [new URL(imageUrl(product.images[0]), origin()).href] : [];
  return { title, description, openGraph: { title, description, images }, twitter: { card: 'summary_large_image', title, description, images } };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const data = await publicProduct((await params).id); if (!data) notFound(); return <ProductDetail {...data} />; }
