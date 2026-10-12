'use client';
import { useEffect, useState } from 'react';
import { ordered, PRIORITIES, PRIORITY_LABELS, timeBR, type QueueRow } from '@/lib/types';
export default function Display() {
  const [items, setItems] = useState<QueueRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const res = await fetch('/api/queue', { cache: 'no-store' });
        if (!res.ok) throw new Error('Connection lost');
        const payload = await res.json() as { items: QueueRow[]; refreshedAt: string };
        if (active) { setItems(ordered(payload.items)); setUpdatedAt(payload.refreshedAt); setOffline(false); }
      } catch { if (active) setOffline(true); }
    }
    void refresh(); const timer = setInterval(() => void refresh(), 5000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  const totals = Object.fromEntries(PRIORITIES.map(p => [p, items.filter(v => v.priority === p).length]));
  return <main className="tv-layout">
    <header className="tv-header"><div className="brand"><span className="brand-mark">🐾</span><span><strong>PET HOME</strong><small>HOSPITAL VETERINÁRIO</small></span></div>
      <h1>ATENDIMENTOS — FILA DE PRIORIDADE</h1><div className="display-note">Acompanhe sua vez<br/>na recepção</div></header>
    <section className="totals"><strong>{items.length}</strong><span>EM ESPERA</span><span className="separator">│</span>
      {PRIORITIES.map(p => <span key={p} className="total"><i className={`dot ${p.toLowerCase()}`}/>{totals[p]} {PRIORITY_LABELS[p].toLowerCase()}{totals[p] === 1 ? '' : 's'}</span>)}</section>
    {offline && <div className="offline" role="alert">Sem conexão. Exibindo última atualização disponível.</div>}
    <section className="queue-cards" aria-live="polite">{items.length === 0 && <div className="empty">Nenhum paciente aguardando atendimento.</div>}
      {items.map(v => <article key={v.id} className={`queue-card ${v.priority.toLowerCase()}`}><span className={`pill ${v.priority.toLowerCase()}`}>{PRIORITY_LABELS[v.priority]}</span>
        <strong className="pet-name">{v.public_label}</strong><span className="time-label">CHEGADA <b>◷ {timeBR(v.arrived_at)}</b></span></article>)}
    </section><footer className="tv-footer"><span>Ordenação: Urgente → Alta → Média → Baixa · Dentro de cada nível, por chegada</span><span>{updatedAt ? `Atualizado às ${timeBR(updatedAt)}` : 'Conectando…'}</span></footer>
  </main>;
}
