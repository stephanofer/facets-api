import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Query timing thresholds for Prisma logging
 */
const QUERY_THRESHOLDS = {
  /** Queries taking longer than this (ms) will log a warning */
  SLOW: 100,
  /** Queries taking longer than this (ms) will log an error */
  VERY_SLOW: 500,
} as const;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  private readonly isDevelopment: boolean;

  constructor(private readonly configService: ConfigService) {
    const pool = new Pool({
      connectionString: configService.database.url,
      max: 20, // Maximum connections in the pool
      idleTimeoutMillis: 30_000, // Close idle connections after 30s
      connectionTimeoutMillis: 5_000, // Timeout new connection attempts after 5s
    });

    const adapter = new PrismaPg(pool);

    // Enable query logging in development
    const isDev = configService.isDevelopment;

    super({
      adapter,
      // log: isDev
      //   ? [
      //       { emit: 'event', level: 'query' },
      //       { emit: 'stdout', level: 'error' },
      //       { emit: 'stdout', level: 'warn' },
      //     ]
      //   : [
      //       { emit: 'stdout', level: 'error' },
      //       { emit: 'stdout', level: 'warn' },
      //     ],
    });

    this.isDevelopment = isDev;
  }

  async onModuleInit(): Promise<void> {
    // Set up query logging with timing analysis in development
    if (this.isDevelopment) {
      // @ts-expect-error - Prisma types don't expose $on for 'query' event properly
      this.$on('query', (event: { query: string; duration: number }) => {
        this.logQuery(event.query, event.duration);
      });

      this.logger.log('Prisma query logging enabled (development mode)');
    }

    await this.$connect();
    this.logger.log('Connected to database');
  }

  /**
   * Log query with timing analysis
   */
  private logQuery(query: string, duration: number): void {
    // Truncate very long queries for readability
    const truncatedQuery =
      query.length > 200 ? `${query.substring(0, 200)}...` : query;

    if (duration >= QUERY_THRESHOLDS.VERY_SLOW) {
      this.logger.error(`[VERY SLOW QUERY] ${duration}ms - ${truncatedQuery}`);
    } else if (duration >= QUERY_THRESHOLDS.SLOW) {
      this.logger.warn(`[SLOW QUERY] ${duration}ms - ${truncatedQuery}`);
    } else {
      this.logger.debug(`[QUERY] ${duration}ms - ${truncatedQuery}`);
    }
  }
}
