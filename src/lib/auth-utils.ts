/**
 * Authentication utilities for JWT validation with Supabase
 */

import { createClient } from '@supabase/supabase-js';

export interface JWTUser {
  sub: string;
  email?: string;
  exp: number;
  iat: number;
}

export async function validateJWT(
  authHeader: string | undefined,
  serviceRoleKey: string,
  supabaseUrl: string
): Promise<JWTUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT token with Supabase
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return {
      sub: user.id,
      email: user.email,
      exp: 0, // Supabase handles expiration
      iat: 0,
    };
  } catch (error) {
    console.error('JWT validation error:', error);
    return null;
  }
}

export function extractUserFromJWT(token: string): JWTUser | null {
  try {
    // Simple JWT parsing (in production, use proper JWT library)
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));

    return {
      sub: decoded.sub,
      email: decoded.email,
      exp: decoded.exp,
      iat: decoded.iat,
    };
  } catch (error) {
    console.error('JWT extraction error:', error);
    return null;
  }
}

export function isTokenExpired(user: JWTUser): boolean {
  const now = Math.floor(Date.now() / 1000);
  return user.exp < now;
}
