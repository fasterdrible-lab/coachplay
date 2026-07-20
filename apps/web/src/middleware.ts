import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // refresh_token é httpOnly cookie definido pelo backend — indica sessão ativa
  const isAuthenticated = !!request.cookies.get('refresh_token')?.value;

  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  if (!isAuthenticated && !isPublic) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Além de api/_next/*, exclui qualquer arquivo estático da pasta public/ (extensão
  // com ponto) — sem isso, pedidos como /logo-mark.png caem no matcher, o middleware
  // redireciona pra /login sem sessão, e o otimizador de imagem do Next.js recebe HTML
  // no lugar do PNG (achado ao trocar a logo: badge aparecia corrompido/em branco).
  matcher: ['/((?!api|_next/static|_next/image|.*\\.[^/]+$).*)'],
};
