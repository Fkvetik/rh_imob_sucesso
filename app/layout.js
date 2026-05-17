import './globals.css';
export const metadata = {
  title: 'RH IMOB CRM',
  description: 'CRM de atendimento RH IMOB',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
