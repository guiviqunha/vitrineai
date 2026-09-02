export type Product = {
  id: string; name: string; category: string; description: string;
  price: number | null; dimensions: string; colors: string;
  images: string[]; published: boolean; position: number; revision: number;
};
export type CatalogSettings = {
  name: string; headline: string; description: string; whatsapp: string;
  accent: string; logo: string; cover: string; showPrices: boolean; revision: number;
};
export type CatalogData = { settings: CatalogSettings; products: Product[] };
export const defaultSettings: CatalogSettings = {
  name: 'VitrineAI', headline: 'Encontre o seu próximo favorito.',
  description: 'Conheça nossos produtos, explore os detalhes e fale com a gente para saber mais.',
  whatsapp: '', accent: '#267344', logo: '', cover: '', showPrices: true, revision: 0,
};
export const imageUrl = (id: string) => `/api/media/${encodeURIComponent(id)}`;
export const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
