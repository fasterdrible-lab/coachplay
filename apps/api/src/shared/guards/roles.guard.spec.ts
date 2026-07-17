import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function buildContext(user: { role: string } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('permite acesso quando a rota não exige roles específicas', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(buildContext({ role: 'player' }))).toBe(true);
  });

  it('permite acesso ao admin em rota restrita a admin', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(buildContext({ role: 'admin' }))).toBe(true);
  });

  it('bloqueia jogador (player) em rota restrita a admin', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(buildContext({ role: 'player' }))).toThrow(ForbiddenException);
  });
});
