import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    const pool = new Pool({
      connectionString: configService.database.url,
    });

    const adapter = new PrismaPg(pool);

    super({
      adapter,
    });
  }
}
