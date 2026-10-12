import Link from 'next/link';
export default function Home() {
  return <main className="landing"><h1>🐾 PET HOME</h1><p>Gerenciamento de fila veterinária</p><div className="actions"><Link href="/admin">Painel da clínica</Link><Link href="/display">Painel da TV</Link></div></main>;
}
