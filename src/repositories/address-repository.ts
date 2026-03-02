import { injectable, inject } from 'tsyringe';
import { addresses } from '../db/schema/addresses.js';
import type { Database, Transaction } from '../db/index.js';

/**
 * Data access layer for company addresses.
 */
@injectable()
export class AddressRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Inserts multiple address rows for a company.
   *
   * @param rows - The address records to insert.
   * @param tx - Optional transaction to run within.
   * @returns The inserted address rows.
   */
  async createMany(
    rows: Array<{
      companyId: number;
      streetAddress?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string | null;
      label?: string | null;
    }>,
    tx?: Transaction,
  ) {
    return (tx ?? this.db).insert(addresses).values(rows).returning();
  }
}
