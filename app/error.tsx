'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="mx-auto max-w-lg px-5 py-24 text-center"><h1 className="text-2xl font-bold">Não foi possível carregar esta página.</h1><p className="my-5 text-sm text-muted-foreground">Tente novamente em instantes. Seus dados salvos permanecem guardados.</p><Button onClick={reset}>Tentar novamente</Button></main>; }
