'use client';
import { useState } from 'react';
import { LockKeyhole, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function AccessForm({ mode }: { mode: 'login' | 'setup' | 'recover' }) {
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const first = mode !== 'login';
  return <div className="mx-auto w-full max-w-md rounded-[28px] border border-border bg-card p-7 sm:p-9"><span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole className="size-6" /></span><p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-primary">VitrineAI · Acesso privado</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">{mode === 'login' ? 'Seu espaço de gestão.' : mode === 'setup' ? 'Crie sua senha.' : 'Recupere seu acesso.'}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{first ? 'Escolha uma senha exclusiva com pelo menos 12 caracteres. Só você terá acesso ao painel.' : 'Entre com sua senha do VitrineAI para gerenciar o catálogo e usar o Studio.'}</p>
    <form className="mt-7 space-y-5" onSubmit={async e => { e.preventDefault(); setError(''); if (first && password !== confirm) { setError('As senhas precisam ser iguais.'); return; } setBusy(true); try { const r = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); const d = await r.json() as { error?: string }; if (!r.ok) throw new Error(d.error); window.location.assign('/admin'); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível entrar.'); setBusy(false); } }}>
      <label className="block space-y-2 text-sm font-semibold">{first ? 'Sua nova senha' : 'Senha'}<Input className="h-11" type="password" required minLength={12} maxLength={128} autoComplete={first ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>
      {first && <label className="block space-y-2 text-sm font-semibold">Repita a senha<Input className="h-11" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={busy} className="h-11 w-full justify-between px-4">{busy ? 'Aguarde…' : first ? 'Salvar senha e entrar' : 'Entrar no painel'}<ArrowRight /></Button>
    </form>{!first && <a href="/configurar-acesso" className="mt-5 block text-center text-xs text-muted-foreground underline">Primeiro acesso ou esqueci minha senha</a>}<a href="/" className="mt-5 block text-center text-xs font-semibold text-primary">← Voltar ao catálogo</a>
  </div>;
}
