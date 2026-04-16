import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async check() {
    let db = 'down';
    try {
      await this.dataSource.query('SELECT 1');
      db = 'up';
    } catch (e) {
      db = 'down';
    }

    return {
      status: 'ok',
      api: 'up',
      db,
      timestamp: new Date().toISOString(),
    };
  }
}
