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
  /// user.touristId — NULL для всіх ролей окрім tourist (self-service кабінет,
  /// ownership-перевірки BR-12/LiqPay). Див. пам'ять known-gap-jwt-tourist-id.
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
