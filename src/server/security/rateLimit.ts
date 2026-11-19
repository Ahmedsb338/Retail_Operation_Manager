import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../../db/index.ts';
import { rateLimits } from '../../db/schema.ts';

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimitPolicy {
  scope: string;
  maxHits: number;
  windowMs: number;
  lockoutMs?: number;
}

export class DatabaseRateLimitStore {
  constructor(private readonly db: AppDatabase) {}

  async checkAndConsume(
    bucketKey: string,
    policy: RateLimitPolicy,
    now: Date = new Date()
  ): Promise<RateLimitDecision> {
    return this.db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(rateLimits)
        .where(eq(rateLimits.bucketKey, bucketKey));

      const existing = existingRows[0];

      if (!existing) {
        await tx.insert(rateLimits).values({
          bucketKey,
          scope: policy.scope,
          windowStart: now,
          hitCount: 1,
          lockedUntil: null,
          updatedAt: now,
        });
        return {
          allowed: true,
          remaining: Math.max(0, policy.maxHits - 1),
          retryAfterSeconds: 0,
        };
      }

      if (existing.lockedUntil && existing.lockedUntil.getTime() > now.getTime()) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((existing.lockedUntil.getTime() - now.getTime()) / 1000)
        );
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds,
        };
      }

      const windowExpired = now.getTime() - existing.windowStart.getTime() >= policy.windowMs;
      if (windowExpired) {
        await tx
          .update(rateLimits)
          .set({
            scope: policy.scope,
            windowStart: now,
            hitCount: 1,
            lockedUntil: null,
            updatedAt: now,
          })
          .where(eq(rateLimits.bucketKey, bucketKey));
        return {
          allowed: true,
          remaining: Math.max(0, policy.maxHits - 1),
          retryAfterSeconds: 0,
        };
      }

      const nextCount = existing.hitCount + 1;
      if (nextCount > policy.maxHits) {
        const lockDuration = policy.lockoutMs ?? policy.windowMs;
        const lockedUntil = new Date(now.getTime() + lockDuration);
        await tx
          .update(rateLimits)
          .set({
            hitCount: nextCount,
            lockedUntil,
            updatedAt: now,
          })
          .where(eq(rateLimits.bucketKey, bucketKey));

        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil(lockDuration / 1000)),
        };
      }

      await tx
        .update(rateLimits)
        .set({
          hitCount: nextCount,
          updatedAt: now,
        })
        .where(eq(rateLimits.bucketKey, bucketKey));

      return {
        allowed: true,
        remaining: Math.max(0, policy.maxHits - nextCount),
        retryAfterSeconds: 0,
      };
    });
  }

  async reset(bucketKey: string): Promise<void> {
    await this.db.delete(rateLimits).where(eq(rateLimits.bucketKey, bucketKey));
  }
}
