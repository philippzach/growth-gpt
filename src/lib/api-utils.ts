/**
 * API utilities for consistent response formatting
 */

import { APIResponse, APIError, ResponseMetadata } from '../types';

export function createAPIResponse(
  data: any, 
  metadata?: Partial<ResponseMetadata>
): APIResponse {
  return {
    success: true,
    data,
    metadata: {
      processingTime: 0,
      sessionId: '',
      ...metadata,
    },
    timestamp: new Date().toISOString()
  };
}

export function createAPIError(
  code: string, 
  message: string, 
  details?: any, 
  recoverable: boolean = false
): APIResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      recoverable
    },
    timestamp: new Date().toISOString()
  };
}

export function validateRequiredFields(data: any, requiredFields: string[]): string[] {
  const missingFields: string[] = [];
  
  for (const field of requiredFields) {
    if (!(field in data) || data[field] === undefined || data[field] === null) {
      missingFields.push(field);
    }
  }
  
  return missingFields;
}

export function sanitizeUserInput(input: string): string {
  // Basic input sanitization
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

export function formatValidationError(field: string, rule: string): string {
  const errorMessages: Record<string, string> = {
    required: `${field} is required`,
    email: `${field} must be a valid email address`,
    minLength: `${field} is too short`,
    maxLength: `${field} is too long`,
    pattern: `${field} format is invalid`
  };
  
  return errorMessages[rule] || `${field} validation failed`;
}

export function calculateProcessingTime(startTime: number): number {
  return Date.now() - startTime;
}

export function logAPICall(
  method: string, 
  path: string, 
  userId?: string, 
  sessionId?: string, 
  processingTime?: number
): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    method,
    path,
    userId,
    sessionId,
    processingTime
  }));
}