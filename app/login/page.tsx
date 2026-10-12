'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function signIn(e: React.FormEvent) {
    e.preventDefault(); setPending(true); setError('');
    try {
      const { error } = await supabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace('/admin');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível autenticar'); }
    finally { setPending(false); }
  }
  return <main className="auth"><form className="panel" onSubmit={signIn}>
    <h1>🐾 Acesso da clínica</h1><label>E-mail<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label>Senha<input type="password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button disabled={pending}>{pending ? 'Entrando…' : 'Entrar'}</button>
  </form></main>;
}
