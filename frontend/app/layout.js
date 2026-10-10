import './globals.css';

export const metadata = {
  title: 'CampusSync',
  description: 'University classroom and event booking platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
