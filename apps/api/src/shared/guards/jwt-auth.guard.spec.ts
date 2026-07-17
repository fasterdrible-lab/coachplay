import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

function buildContext(): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('permite acesso a rotas marcadas com @Public() sem validar o token', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);

    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('lança UnauthorizedException quando não há usuário autenticado (sem token)', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);

    expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
  });

  it('propaga o erro original quando a estratégia falha (ex.: token inválido/expirado)', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    const originalError = new Error('jwt expired');

    expect(() => guard.handleRequest(originalError, null)).toThrow(originalError);
  });

  it('retorna o usuário quando a autenticação é bem-sucedida', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    const user = { id: 'user-1', email: 'a@a.com', role: 'player' };

    expect(guard.handleRequest(null, user)).toBe(user);
  });
});
