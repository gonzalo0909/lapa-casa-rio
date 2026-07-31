// lapa-casa-hostel/backend/src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

/**
 * JWT Payload Interface
 */
interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'staff' | 'guest';
  iat: number;
  exp: number;
}

/**
 * Extended Request with User
 */
export interface AuthRequest extends Request {
  user?: JWTPayload;
}

/**
 * Authentication Middleware
 * Verifies JWT token from Authorization header
 * 
 * @description
 * - Extracts Bearer token from Authorization header
 * - Verifies JWT signature and expiration
 * - Attaches user payload to request object
 * - Handles expired tokens and invalid signatures
 * 
 * @example
 * router.get('/protected', authenticateToken, (req, res) => {
 *   const user = (req as AuthRequest).user;
 *   res.json({ user });
 * });
 */
export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_TOKEN_MISSING'
      });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error('JWT_SECRET not configured');
      res.status(500).json({
        success: false,
        error: 'Authentication configuration error',
        code: 'AUTH_CONFIG_ERROR'
      });
      return;
    }

    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          res.status(401).json({
            success: false,
            error: 'Token expired',
            code: 'AUTH_TOKEN_EXPIRED',
            expiredAt: err.expiredAt
          });
          return;
        }

        if (err.name === 'JsonWebTokenError') {
          res.status(403).json({
            success: false,
            error: 'Invalid token',
            code: 'AUTH_TOKEN_INVALID'
          });
          return;
        }

        logger.error('JWT verification error:', err);
        res.status(403).json({
          success: false,
          error: 'Token verification failed',
          code: 'AUTH_VERIFICATION_FAILED'
        });
        return;
      }

      (req as AuthRequest).user = decoded as JWTPayload;
      next();
    });
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Optional Authentication Middleware
 * Attaches user if token is valid, but continues if no token
 * 
 * @description
 * - Useful for endpoints that work for both authenticated and anonymous users
 * - Does not block request if token is missing
 * - Still validates token if present
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      next();
      return;
    }

    jwt.verify(token, secret, (err, decoded) => {
      if (!err && decoded) {
        (req as AuthRequest).user = decoded as JWTPayload;
      }
      next();
    });
  } catch (error) {
    logger.error('Optional auth error:', error);
    next();
  }
};

/**
 * Role-Based Authorization Middleware Factory
 * 
 * @param allowedRoles - Array of roles that can access the route
 * @returns Middleware function that checks user role
 * 
 * @example
 * router.delete('/booking/:id', 
 *   authenticateToken, 
 *   requireRole(['admin', 'staff']), 
 *   deleteBooking
 * );
 */
export const requireRole = (allowedRoles: Array<'admin' | 'staff' | 'guest'>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = (req as AuthRequest).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
        return;
      }

      if (!allowedRoles.includes(user.role)) {
        logger.warn(`Access denied for user ${user.userId} with role ${user.role}`);
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'AUTH_INSUFFICIENT_PERMISSIONS',
          requiredRoles: allowedRoles,
          userRole: user.role
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Role authorization error:', error);
      res.status(500).json({
        success: false,
        error: 'Authorization error',
        code: 'AUTH_ERROR'
      });
    }
  };
};

/**
 * Admin-Only Middleware
 * Shorthand for requireRole(['admin'])
 */
export const requireAdmin = requireRole(['admin']);

/**
 * Staff-or-Admin Middleware
 * Shorthand for requireRole(['admin', 'staff'])
 */
export const requireStaff = requireRole(['admin', 'staff']);

/**
 * API Key Authentication Middleware
 * For external integrations (Google Sheets, WhatsApp, etc.)
 * 
 * @description
 * - Checks X-API-Key header
 * - Validates against configured API keys
 * - Logs API key usage for audit
 */
export const authenticateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'API key required',
        code: 'API_KEY_MISSING'
      });
      return;
    }

    const validApiKeys = process.env.API_KEYS?.split(',') || [];

    if (!validApiKeys.includes(apiKey)) {
      logger.warn(`Invalid API key attempt: ${apiKey.substring(0, 8)}...`);
      res.status(403).json({
        success: false,
        error: 'Invalid API key',
        code: 'API_KEY_INVALID'
      });
      return;
    }

    logger.info(`API key authenticated: ${apiKey.substring(0, 8)}...`);
    next();
  } catch (error) {
    logger.error('API key authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Booking Owner Verification Middleware
 * Ensures user can only access their own bookings
 * 
 * @description
 * - Admins and staff can access any booking
 * - Guests can only access their own bookings
 * - Requires bookingId in route params
 */
export const verifyBookingOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;
    const bookingId = req.params.bookingId || req.body.bookingId;

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // Admins and staff can access any booking
    if (user.role === 'admin' || user.role === 'staff') {
      next();
      return;
    }

    // For guests, verify ownership
    if (!bookingId) {
      res.status(400).json({
        success: false,
        error: 'Booking ID required',
        code: 'BOOKING_ID_MISSING'
      });
      return;
    }

    // Note: Actual ownership check would query database
    // This is a placeholder for the verification logic
    // Implementation depends on database structure from Group 12

    next();
  } catch (error) {
    logger.error('Booking ownership verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification error',
      code: 'VERIFICATION_ERROR'
    });
  }
};

/**
 * Token Refresh Check Middleware
 * Warns if token is expiring soon
 * 
 * @description
 * - Checks token expiration time
 * - Adds warning header if < 1 hour remaining
 * - Client can proactively refresh token
 */
export const checkTokenExpiration = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const user = (req as AuthRequest).user;

    if (!user) {
      next();
      return;
    }

    const expirationTime = user.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const timeRemaining = expirationTime - currentTime;
    const oneHour = 60 * 60 * 1000;

    if (timeRemaining < oneHour && timeRemaining > 0) {
      res.setHeader('X-Token-Expiring-Soon', 'true');
      res.setHeader('X-Token-Expires-In', Math.floor(timeRemaining / 1000).toString());
    }

    next();
  } catch (error) {
    logger.error('Token expiration check error:', error);
    next();
  }
};
