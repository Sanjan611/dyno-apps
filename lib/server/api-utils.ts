/**
 * API Utilities
 * 
 * Middleware and helper functions for API routes to reduce boilerplate
 * and ensure consistent response patterns.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import type { ApiResponse, ApiErrorResponse, ApiSuccessResponse } from "@/types/api";
import { ERROR_MESSAGES } from "@/lib/constants";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Authenticated user from Supabase
 */
export type AuthenticatedUser = {
  id: string;
  email?: string;
  [key: string]: unknown;
};

/**
 * Handler function for authenticated routes
 */
export type AuthenticatedHandler<T = unknown> = (
  request: NextRequest,
  user: AuthenticatedUser,
  params?: { [key: string]: string | Promise<string> }
) => Promise<NextResponse<ApiResponse<T>>>;

/**
 * Handler function for authenticated routes with async params (for dynamic routes)
 */
export type AuthenticatedHandlerWithParams<T = unknown> = (
  request: NextRequest,
  user: AuthenticatedUser,
  params: { [key: string]: string }
) => Promise<NextResponse<ApiResponse<T>>>;

/**
 * Handler function for routes that may or may not require auth
 */
export type Handler<T = unknown> = (
  request: NextRequest,
  params?: { [key: string]: string | Promise<string> }
) => Promise<NextResponse<ApiResponse<T>>>;

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Creates a standardized success response
 * 
 * Note: The response object will have `success: true` and the data fields
 * spread directly onto it (not wrapped in a `data` field) to match
 * the existing API contract.
 */
export function successResponse<T extends Record<string, unknown>>(
  data: T,
  status: number = 200
): NextResponse<{ success: true } & T> {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    { status }
  );
}

/**
 * Creates a standardized error response
 */
export function errorResponse(
  error: string,
  status: number = 500,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details !== undefined ? { details } : {}),
    },
    { status }
  );
}

/**
 * Creates an unauthorized response
 */
export function unauthorizedResponse(
  message: string = ERROR_MESSAGES.UNAUTHORIZED
): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 401);
}

/**
 * Creates a not found response
 */
export function notFoundResponse(
  message: string = ERROR_MESSAGES.PROJECT_NOT_FOUND
): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 404);
}

/**
 * Creates a bad request response
 */
export function badRequestResponse(
  message: string = ERROR_MESSAGES.INVALID_REQUEST
): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 400);
}

/**
 * Creates an internal server error response
 */
export function internalErrorResponse(
  error: unknown,
  includeDetails: boolean = false
): NextResponse<ApiErrorResponse> {
  const errorMessage =
    error instanceof Error ? error.message : ERROR_MESSAGES.INTERNAL_ERROR;
  const errorDetails = error instanceof Error ? error.stack : undefined;

  return NextResponse.json(
    {
      success: false,
      error: errorMessage,
      ...(includeDetails && errorDetails ? { details: errorDetails } : {}),
    },
    { status: 500 }
  );
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Higher-order function that wraps a handler with authentication
 * 
 * @example
 * ```typescript
 * export const GET = withAuth(async (request, user) => {
 *   // user is guaranteed to be authenticated
 *   return successResponse({ message: "Hello", userId: user.id });
 * });
 * ```
 */
export function withAuth<T = unknown>(
  handler: AuthenticatedHandler<T>
): (request: NextRequest) => Promise<NextResponse<ApiResponse<T>>> {
  return async (request: NextRequest) => {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return unauthorizedResponse();
    }

    try {
      return await handler(request, user as AuthenticatedUser);
    } catch (error) {
      console.error("[api-utils] Error in authenticated handler:", error);
      return internalErrorResponse(error);
    }
  };
}

/**
 * Wrapper for route handlers that handles async params
 * 
 * @example
 * ```typescript
 * export const DELETE = withAsyncParams(async (request, user, params) => {
 *   const { id } = params;
 *   // ... handler logic
 * });
 * ```
 */
export function withAsyncParams<T = unknown>(
  handler: AuthenticatedHandlerWithParams<T>
): (request: NextRequest, context: { params: Promise<{ [key: string]: string }> }) => Promise<NextResponse<ApiResponse<T>>> {
  return async (request: NextRequest, context: { params: Promise<{ [key: string]: string }> }) => {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return unauthorizedResponse();
    }

    try {
      const params = await context.params;
      return await handler(request, user as AuthenticatedUser, params);
    } catch (error) {
      console.error("[api-utils] Error in handler with async params:", error);
      return internalErrorResponse(error);
    }
  };
}
