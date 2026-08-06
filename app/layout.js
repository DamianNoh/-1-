import './globals.css';
import TopNav from './TopNav';

export const metadata = {
  title: 'CPC 대시보드',
  description: '월별 CPC 관리 대시보드'
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
