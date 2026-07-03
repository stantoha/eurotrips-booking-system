// =============================================================================
// EUROTRIPS — Auth Types
// =============================================================================

import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;          // user.id
  email: string;
  role: UserRole;
  agentId: string | null;
  agentType: 'standard' | 'network' | null;
  networkId: string | null;
  /** Тільки для role='tourist' — резолвиться за збігом email з tourists.email */
  touristId: string | null;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  expiresIn: number;   // секунди
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  agentId: string | null;
  agentType: 'standard' | 'network' | null;
  networkId: string | null;
  touristId: string | null;
}
