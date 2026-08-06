'use client';
import { usePathname, useRouter } from 'next/navigation';

const LINKS = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/admin/cpc-data', label: 'CPC 데이터' },
  { href: '/admin/workers', label: '근무자' },
  { href: '/admin/schedule', label: '기본 스케줄' },
  { href: '/admin/hours', label: '일일 근무시간' }
];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/login') return null;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="topnav">
      <div className="brand">CPC 관리 대시보드</div>
      <nav>
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} className={pathname.startsWith(l.href) ? 'active' : ''}>
            {l.label}
          </a>
        ))}
      </nav>
      <button className="logout" onClick={logout}>로그아웃</button>
    </div>
  );
}
