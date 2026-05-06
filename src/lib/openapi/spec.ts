/**
 * OpenAPI 3.1 specification definition for the Lavo API.
 *
 * Centralizes the base swagger definition (info, servers, security schemes,
 * and reusable component schemas). The full spec is assembled at runtime by
 * swagger-jsdoc by scanning JSDoc @swagger annotations from route files.
 *
 * Usage: import { swaggerDefinition } from '@/lib/openapi/spec'
 */
import type { OAS3Definition } from 'swagger-jsdoc';

/**
 * Base OpenAPI 3.1 definition consumed by swagger-jsdoc.
 * Component schemas and security schemes are declared here so route
 * annotations can reference them with $ref without re-declaring them.
 */
export const swaggerDefinition: OAS3Definition = {
  openapi: '3.1.0',
  info: {
    title: 'Lavo API',
    version: '1.0.0',
    description:
      'REST API for the Lavo car-wash platform. ' +
      'Authentication uses Bearer JWT access tokens issued at login/register. ' +
      'The refresh token is stored in an httpOnly cookie and rotated via POST /api/v1/auth/refresh.',
    contact: {
      name: 'Lavo Engineering',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Current version',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token issued at login or register. Lifetime: 15 minutes.',
      },
    },
    schemas: {
      /* ------------------------------------------------------------------ */
      /* Generic wrappers                                                     */
      /* ------------------------------------------------------------------ */
      SuccessEnvelope: {
        type: 'object',
        description: 'Standard success envelope. Status code is the primary success signal.',
        properties: {
          message: { type: 'string' },
          data: {},
        },
        required: ['data'],
      },
      ErrorEnvelope: {
        type: 'object',
        description: 'Standard error envelope. Status code is the primary error signal.',
        properties: {
          message: { type: 'string' },
          code: { type: 'string' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' },
              },
              required: ['field', 'message'],
            },
          },
        },
        required: ['message'],
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          total: { type: 'integer', minimum: 0 },
          page: { type: 'integer', minimum: 1 },
          per_page: { type: 'integer', minimum: 1 },
        },
        required: ['total', 'page', 'per_page'],
      },

      /* ------------------------------------------------------------------ */
      /* Auth                                                                 */
      /* ------------------------------------------------------------------ */
      AuthUser: {
        type: 'object',
        description: 'Authenticated user summary returned after login or register.',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          role: { type: 'string', enum: ['client', 'station', 'admin'] },
          email_verified: { type: 'boolean' },
        },
        required: ['id', 'email', 'role'],
      },
      TokensResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/AuthUser' },
          access_token: { type: 'string' },
          token_type: { type: 'string', example: 'Bearer' },
          expires_in: { type: 'integer', description: 'Seconds until the access token expires.' },
        },
        required: ['user', 'access_token', 'token_type', 'expires_in'],
      },

      /* ------------------------------------------------------------------ */
      /* Stations                                                             */
      /* ------------------------------------------------------------------ */
      Station: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          address: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'active', 'rejected', 'suspended'] },
          is_open: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'name', 'status'],
      },

      /* ------------------------------------------------------------------ */
      /* Entries (reservations + queue)                                       */
      /* ------------------------------------------------------------------ */
      Entry: {
        type: 'object',
        description: 'A client entry - either a confirmed reservation or a walk-in queue entry.',
        properties: {
          id: { type: 'string', format: 'uuid' },
          station_id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['reservation', 'queue'] },
          status: {
            type: 'string',
            enum: [
              'pending',
              'confirmed',
              'in_progress',
              'completed',
              'cancelled',
              'late',
              'no_show',
            ],
          },
          scheduled_at: { type: ['string', 'null'], format: 'date-time' },
          vehicle_format_id: { type: ['string', 'null'], format: 'uuid' },
          queue_position: { type: ['integer', 'null'] },
          created_at: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'station_id', 'user_id', 'type', 'status'],
      },

      /* ------------------------------------------------------------------ */
      /* Disputes                                                             */
      /* ------------------------------------------------------------------ */
      Dispute: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          reservation_id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['open', 'resolved', 'rejected', 'refunded'] },
          reason: { type: 'string' },
          admin_note: { type: ['string', 'null'] },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'reservation_id', 'user_id', 'status', 'reason'],
      },

      /* ------------------------------------------------------------------ */
      /* Platform settings                                                    */
      /* ------------------------------------------------------------------ */
      PlatformSettingRow: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'string' },
          updated_at: { type: ['string', 'null'], format: 'date-time' },
          updated_by: { type: ['string', 'null'], format: 'uuid' },
        },
        required: ['key', 'value'],
      },

      /* ------------------------------------------------------------------ */
      /* Analytics                                                            */
      /* ------------------------------------------------------------------ */
      AnalyticsSeries: {
        type: 'object',
        properties: {
          metric: { type: 'string', enum: ['revenue', 'clients', 'completed'] },
          series: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date' },
                value: { type: 'number' },
              },
              required: ['date', 'value'],
            },
          },
        },
        required: ['metric', 'series'],
      },
      StationDashboard: {
        type: 'object',
        properties: {
          total_revenue: { type: 'number' },
          total_clients: { type: 'integer' },
          total_completed: { type: 'integer' },
          average_rating: { type: ['number', 'null'] },
          pending_count: { type: 'integer' },
          month: { type: 'string', example: '2026-04' },
        },
        required: ['total_revenue', 'total_clients', 'total_completed', 'pending_count', 'month'],
      },

      /* ------------------------------------------------------------------ */
      /* Delays                                                               */
      /* ------------------------------------------------------------------ */
      DelayRequest: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          reservation_id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          station_id: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['pending', 'accepted', 'refused'] },
          message: { type: ['string', 'null'] },
          refusal_reason: { type: ['string', 'null'] },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'reservation_id', 'user_id', 'station_id', 'status'],
      },

      /* ------------------------------------------------------------------ */
      /* Legal content                                                        */
      /* ------------------------------------------------------------------ */
      LegalContent: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            enum: ['cgu', 'politique_confidentialite', 'mentions_legales'],
          },
          content: { type: ['string', 'null'] },
        },
        required: ['key', 'content'],
      },
    },
  },
  security: [],
  paths: {},
};
