import 'server-only';
import type { NextRequest } from 'next/server';
import { adminAuth } from './firebase-admin';

export class ApiAuthError extends Error {
  constructor(public readonly status: 401 | 403 | 500, public readonly code: string) {
    super(code);
    this.name = 'ApiAuthError';
  }
}

export async function requireAdmin(req: NextRequest) {
  const header = req.headers.get('authorization');
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    console.warn('[AUTH] Authorization Bearer ausente ou malformado');
    throw new ApiAuthError(401, 'TOKEN_AUSENTE');
  }

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(match[1], true);
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code ?? 'unknown';
    console.error('[AUTH] Falha ao validar token:', code);
    if (code === 'auth/argument-error' || code === 'auth/id-token-expired' || code === 'auth/id-token-revoked' || code === 'auth/invalid-id-token' || code === 'auth/invalid-argument') {
      throw new ApiAuthError(401, 'TOKEN_INVALIDO_OU_EXPIRADO');
    }
    if (code === 'auth/project-not-found' || code === 'auth/invalid-credential') {
      throw new ApiAuthError(500, 'CONFIGURACAO_FIREBASE_ADMIN');
    }
    // Do not expose SDK error text, which may contain sensitive details.
    throw new ApiAuthError(500, 'FALHA_VALIDACAO_FIREBASE');
  }

  const allowedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowedEmail) {
    console.error('[AUTH] ADMIN_EMAIL não configurado');
    throw new ApiAuthError(500, 'ADMIN_EMAIL_NAO_CONFIGURADO');
  }
  if (!decoded.email || decoded.email.toLowerCase() !== allowedEmail) {
    console.warn('[AUTH] Usuário autenticado não está na lista de administradores');
    throw new ApiAuthError(403, 'SEM_PERMISSAO_ADMIN');
  }
  return decoded;
}
