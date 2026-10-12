'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ordered, PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, timeBR, type Priority, type StaffVisit, type VisitStatus } from '@/lib/types';
export default function Admin() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState('');
  const [rows, setRows] = useState<StaffVisit[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Cão');
  const [tutor, setTutor] = useState('');
  const [priority, setPriority] = useState<Priority>('LOW');
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState('');
  const [patients, setPatients] = useState<{ id: string; name: string; tutor_name: string | null }[]>([]);
  const load = useCallback(async () => {
    const { data, error } = await supabase().from('visits').select('id,patient_id,public_label,priority,status,arrived_at,patients(name,species,tutor_name)').in('status', ['WAITING','CALLED','IN_SERVICE']).order('arrived_at');
    if (error) setError(error.message);
    else setRows((data ?? []) as unknown as StaffVisit[]);
  }, []);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const { data: { user } } = await supabase().auth.getUser();
        if (!user) { router.replace('/login'); return; }
        const { data: staff, error } = await supabase().from('staff_members').select('role').eq('user_id', user.id).single();
        if (error || !staff) { await supabase().auth.signOut(); router.replace('/login'); return; }
        if (mounted) { setRole(staff.role); setReady(true); }
        await load();
      } catch (e) { if (mounted) setError(String(e)); }
    })();
    const timer = setInterval(() => void load(), 5000);
    return () => { mounted = false; clearInterval(timer); };
  }, [router, load]);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void (async () => {
      const { data } = await supabase().from('patients').select('id,name,tutor_name').ilike('name', `%${search.replaceAll('%', '')}%`).order('name').limit(15);
      if (active) setPatients(data ?? []);
    })();
    return () => { active = false; };
  }, [search, ready]);
  async function createVisit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      let patientId = selectedPatient;
      if (!patientId) {
        if (name.trim().length < 2) throw new Error('Informe o nome do animal.');
        const { data, error } = await supabase().from('patients').insert({ name: name.trim(), species, tutor_name: tutor.trim() || null }).select('id').single();
        if (error) throw error;
        patientId = data.id;
      }
      const publicLabel = selectedPatient ? (patients.find(p => p.id === selectedPatient)?.name ?? 'Paciente') : name.trim();
      const { error } = await supabase().from('visits').insert({ patient_id: patientId, priority, public_label: publicLabel, status: 'WAITING' });
      if (error) throw error;
      setName(''); setTutor(''); setSelectedPatient(''); setSearch(''); setPriority('LOW'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao cadastrar'); }
    finally { setBusy(false); }
  }
  async function changePriority(id: string, next: Priority) {
    if (!window.confirm(`Alterar prioridade para ${PRIORITY_LABELS[next]}?`)) return;
    const reason = window.prompt('Motivo da alteração de prioridade (obrigatório):');
    if (!reason?.trim()) return;
    setBusy(true); setError('');
    const { error } = await supabase().rpc('change_visit_priority', { p_visit_id: id, p_priority: next, p_reason: reason.trim() });
    if (error) setError(error.message);
    await load(); setBusy(false);
  }
  async function changeStatus(id: string, next: VisitStatus) {
    if (next === 'CANCELLED' && !window.confirm('Cancelar atendimento? O histórico será preservado.')) return;
    setBusy(true); setError('');
    const { error } = await supabase().rpc('change_visit_status', { p_visit_id: id, p_status: next });
    if (error) setError(error.message);
    await load(); setBusy(false);
  }
  if (!ready) return <main className="landing">Verificando acesso… {error}</main>;
  const triageAllowed = role === 'VET' || role === 'ADMIN';
  return <main className="admin-layout"><header className="admin-head"><h1>🐾 PET HOME — Recepção</h1><div><span className="muted">Perfil: {role}</span> <a href="/display" target="_blank" rel="noreferrer">Abrir TV ↗</a> <button className="secondary" onClick={async () => { await supabase().auth.signOut(); router.replace('/login'); }}>Sair</button></div></header>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="admin-columns"><section className="panel"><h2>Novo atendimento</h2><p className="muted">Selecione um animal existente ou cadastre um novo.</p>
      <form onSubmit={createVisit} className="stack"><label>Localizar animal<input value={search} onChange={e => { setSearch(e.target.value); setSelectedPatient(''); }} placeholder="Buscar por nome" /></label>
        {search && <label>Animal cadastrado<select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}><option value="">Cadastrar novo animal</option>{patients.map(p => <option value={p.id} key={p.id}>{p.name} {p.tutor_name ? `— ${p.tutor_name}` : ''}</option>)}</select></label>}
        {!selectedPatient && <><label>Nome do animal<input required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
          <label>Espécie<select value={species} onChange={e => setSpecies(e.target.value)}><option>Cão</option><option>Gato</option><option>Outro</option></select></label>
          <label>Tutor (visível apenas à equipe)<input maxLength={120} value={tutor} onChange={e => setTutor(e.target.value)} /></label></>}
        <label>Prioridade<select value={priority} disabled={!triageAllowed} onChange={e => setPriority(e.target.value as Priority)}>{PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}</select></label>
        {!triageAllowed && <small className="muted">Recepção registra prioridade baixa; triagem pode alterar posteriormente.</small>}
        <button disabled={busy}>{busy ? 'Salvando…' : 'Adicionar à fila'}</button>
      </form></section>
      <section className="panel"><h2>Fila ativa ({rows.filter(x => x.status === 'WAITING').length} aguardando)</h2><div className="admin-list">{ordered(rows.filter(x => x.status === 'WAITING')).concat(rows.filter(x => x.status !== 'WAITING')).map(v => <article className="admin-item" key={v.id}>
        <div><strong>{v.patients?.name || v.public_label}</strong><span className="muted">{v.patients?.tutor_name ? ` · Tutor: ${v.patients.tutor_name}` : ''} · {timeBR(v.arrived_at)}</span><div className="muted">{STATUS_LABELS[v.status]}</div></div>
        <div className="item-controls"><select aria-label={`Prioridade ${v.public_label}`} disabled={busy || !triageAllowed || v.status !== 'WAITING'} value={v.priority} onChange={e => void changePriority(v.id, e.target.value as Priority)}>{PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}</select>
        {v.status === 'WAITING' && <button disabled={busy} onClick={() => void changeStatus(v.id, 'CALLED')}>Chamar</button>}
        {v.status === 'CALLED' && <button disabled={busy} onClick={() => void changeStatus(v.id, 'IN_SERVICE')}>Iniciar</button>}
        {v.status === 'IN_SERVICE' && <button disabled={busy} onClick={() => void changeStatus(v.id, 'COMPLETED')}>Concluir</button>}
        {v.status !== 'IN_SERVICE' && <button className="secondary" disabled={busy} onClick={() => void changeStatus(v.id, 'CANCELLED')}>Cancelar</button>}</div>
      </article>)}{rows.length === 0 && <p className="muted">Sem atendimentos ativos.</p>}</div></section></div>
    </main>;
}
