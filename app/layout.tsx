import type { Metadata } from 'next';
import './styles.css';
export const metadata: Metadata = { title: 'Pet Home | Fila de atendimento', description: 'Fila de prioridade veterinária' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
