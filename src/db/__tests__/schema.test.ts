import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { count, eq } from 'drizzle-orm';
import {
  DatabaseUnavailableError,
  getDb,
  getMissingDatabaseEnvVars,
  isDatabaseConfigured,
  resolvePgSslConfig,
} from '../index.ts';
import {
  actionPlans,
  appRoleEnum,
  areaManagerAssignments,
  areaManagers,
  auditLog,
  branchCredentials,
  branches,
  branchHealthConfigs,
  complaints,
  lateOpenings,
  pillarTargets,
  rateLimits,
  salesBoxes,
  sessions,
  staffMembers,
  storeSchedules,
  storeTasks,
  unconfiguredBranches,
} from '../schema.ts';
import {
  seedVerifiedReferenceCatalog,
  UNCONFIGURED_BRANCH_NAMES,
  VERIFIED_BRANCH_1750,
} from '../referenceSeed.ts';
import { createMigratedTestDb, type TestDbContext } from './testDb.ts';

describe('Phase 2A — PostgreSQL Schema, Migrations & Constraints', () => {
  let ctx: TestDbContext | null = null;

  afterEach(async () => {
    if (ctx) {
      await ctx.close();
      ctx = null;
    }
  });

  it('explicitly fails when PostgreSQL SQL_* configuration is missing (no silent fallback)', () => {
    const emptyEnv = {} as NodeJS.ProcessEnv;
    assert.equal(isDatabaseConfigured(emptyEnv), false);
    assert.deepEqual(getMissingDatabaseEnvVars(emptyEnv), [
      'SQL_HOST',
      'SQL_DB_NAME',
      'SQL_USER',
      'SQL_PASSWORD',
    ]);

    const prev = {
      SQL_HOST: process.env.SQL_HOST,
      SQL_DB_NAME: process.env.SQL_DB_NAME,
      SQL_USER: process.env.SQL_USER,
      SQL_PASSWORD: process.env.SQL_PASSWORD,
    };
    try {
      delete process.env.SQL_HOST;
      delete process.env.SQL_DB_NAME;
      delete process.env.SQL_USER;
      delete process.env.SQL_PASSWORD;
      assert.throws(() => getDb(), (err: unknown) => {
        return err instanceof DatabaseUnavailableError && err.statusCode === 503;
      });
    } finally {
      Object.assign(process.env, prev);
    }

    assert.deepEqual(
      resolvePgSslConfig({ SQL_HOST: 'aws-0-eu-west-2.pooler.supabase.com' } as NodeJS.ProcessEnv),
      { rejectUnauthorized: false }
    );
    assert.deepEqual(
      resolvePgSslConfig({ SQL_HOST: 'db.abcdef.supabase.co' } as NodeJS.ProcessEnv),
      { rejectUnauthorized: false }
    );
    assert.equal(
      resolvePgSslConfig({ SQL_HOST: 'db.abcdef.supabase.co', SQL_SSL: 'false' } as NodeJS.ProcessEnv),
      false
    );
    assert.deepEqual(
      resolvePgSslConfig({ SQL_HOST: 'localhost', SQL_SSL: 'true' } as NodeJS.ProcessEnv),
      { rejectUnauthorized: false }
    );
    assert.deepEqual(
      resolvePgSslConfig({ SQL_HOST: 'localhost', SQL_SSL_CA: 'CERT\\nLINE2' } as NodeJS.ProcessEnv),
      { rejectUnauthorized: true, ca: 'CERT\nLINE2' }
    );
  });

  it('applies all versioned migrations cleanly and creates all 30 expected tables', async () => {
    ctx = await createMigratedTestDb();

    const result = await ctx.client.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );

    const tableNames = result.rows.map((r) => r.table_name);
    const expectedTables = [
      'action_plans',
      'agent_kpi_records',
      'agent_rpm_records',
      'ai_diagnostic_snapshots',
      'area_manager_assignments',
      'area_managers',
      'audit_log',
      'branch_credentials',
      'branch_health_configs',
      'branches',
      'coaching_sessions',
      'complaints',
      'hr_actions',
      'late_opening',
      'pillar_targets',
      'rate_limits',
      'sales_boxes',
      'schedule_exceptions',
      'sessions',
      'short_over',
      'staff_members',
      'store_kpi_records',
      'store_rpm_records',
      'store_schedules',
      'store_tasks',
      'system_configs',
      'target_calculator_states',
      'tnps_agent_records',
      'tnps_store_records',
      'unconfigured_branches',
    ];

    assert.deepEqual(tableNames, expectedTables);
    assert.deepEqual(appRoleEnum.enumValues, ['STORE_MANAGER', 'AREA_MANAGER']);
  });

  it('seeds ONLY verified Branch 1750 and separates 13 unconfigured branch names with zero demo records or default credentials', async () => {
    ctx = await createMigratedTestDb();

    await seedVerifiedReferenceCatalog(ctx.db);
    // Re-run to confirm idempotency
    await seedVerifiedReferenceCatalog(ctx.db);

    const configured = await ctx.db.select().from(branches);
    assert.equal(configured.length, 1);
    assert.equal(configured[0].code, VERIFIED_BRANCH_1750.code);
    assert.equal(configured[0].storeId, VERIFIED_BRANCH_1750.code);
    assert.equal(configured[0].name, VERIFIED_BRANCH_1750.name);

    const unconfigured = await ctx.db.select().from(unconfiguredBranches);
    assert.equal(unconfigured.length, UNCONFIGURED_BRANCH_NAMES.length);
    assert.equal(unconfigured.length, 13);

    const targets = await ctx.db.select().from(pillarTargets);
    assert.equal(targets.length, 5);
    assert.ok(targets.every((t) => t.monthlyTarget === null));

    const [{ value: credCount }] = await ctx.db.select({ value: count() }).from(branchCredentials);
    const [{ value: amCount }] = await ctx.db.select({ value: count() }).from(areaManagers);
    const [{ value: taskCount }] = await ctx.db.select({ value: count() }).from(storeTasks);
    const [{ value: staffCount }] = await ctx.db.select({ value: count() }).from(staffMembers);
    const [{ value: complaintCount }] = await ctx.db.select({ value: count() }).from(complaints);
    const [{ value: salesBoxCount }] = await ctx.db.select({ value: count() }).from(salesBoxes);

    assert.equal(Number(credCount), 0);
    assert.equal(Number(amCount), 0);
    assert.equal(Number(taskCount), 0);
    assert.equal(Number(staffCount), 0);
    assert.equal(Number(complaintCount), 0);
    assert.equal(Number(salesBoxCount), 0);
  });

  it('enforces store_id = code, separated branch credentials, role limits, and no ALL wildcard assignments', async () => {
    ctx = await createMigratedTestDb();
    await seedVerifiedReferenceCatalog(ctx.db);

    // Mismatched store_id must fail
    await assert.rejects(
      ctx.db.insert(branches).values({
        code: '9999',
        storeId: '8888',
        name: 'Test Mismatch Store',
      })
    );

    // Invalid app_role must fail at enum level
    await assert.rejects(
      ctx.client.query(`INSERT INTO area_managers (username, username_normalized, display_name, role, password_hash)
                        VALUES ('owner', 'owner', 'Owner', 'PLATFORM_OWNER', 'hash')`)
    );

    // Separated branch credential works cleanly with FK
    const [cred] = await ctx.db
      .insert(branchCredentials)
      .values({
        branchCode: '1750',
        codeHash: 'salt:scrypt_hash_placeholder',
      })
      .returning();
    assert.equal(cred.branchCode, '1750');
    assert.equal(cred.tokenVersion, 1);

    // Duplicate branch credential for same branch rejected
    await assert.rejects(
      ctx.db.insert(branchCredentials).values({
        branchCode: '1750',
        codeHash: 'salt:another_hash',
      })
    );

    // Area Manager + explicit assignments (reject 'ALL' or '*')
    const [am] = await ctx.db
      .insert(areaManagers)
      .values({
        username: 'am_beheira',
        usernameNormalized: 'am_beheira',
        displayName: 'Beheira Area Manager',
        passwordHash: 'salt:scrypt_hash',
      })
      .returning();

    for (const forbidden of ['ALL', 'all', '*', 'ANY', '   ']) {
      await assert.rejects(
        ctx.db.insert(areaManagerAssignments).values({
          areaManagerId: am.id,
          areaName: forbidden,
        })
      );
    }

    const [validAssignment] = await ctx.db
      .insert(areaManagerAssignments)
      .values({
        areaManagerId: am.id,
        areaName: 'El Beheira',
        branchCode: '1750',
      })
      .returning();
    assert.equal(validAssignment.areaName, 'El Beheira');

    // Duplicate active branch assignment rejected
    await assert.rejects(
      ctx.db.insert(areaManagerAssignments).values({
        areaManagerId: am.id,
        areaName: 'El Beheira',
        branchCode: '1750',
      })
    );
  });

  it('enforces session principal binding, schedule shifts, late_opening nullability, health weights, and rate limits', async () => {
    ctx = await createMigratedTestDb();
    await seedVerifiedReferenceCatalog(ctx.db);

    const [am] = await ctx.db
      .insert(areaManagers)
      .values({
        username: 'am_north',
        usernameNormalized: 'am_north',
        displayName: 'North Area Manager',
        passwordHash: 'salt:hash',
      })
      .returning();

    // STORE_MANAGER session cannot omit branchCode or include areaManagerId
    await assert.rejects(
      ctx.db.insert(sessions).values({
        tokenHash: 'bad_sm_session',
        role: 'STORE_MANAGER',
        branchCode: null,
        areaManagerId: am.id,
        tokenVersion: 1,
        expiresAt: new Date(Date.now() + 3600_000),
      })
    );

    const [smSession] = await ctx.db
      .insert(sessions)
      .values({
        tokenHash: 'good_sm_session',
        role: 'STORE_MANAGER',
        branchCode: '1750',
        areaManagerId: null,
        tokenVersion: 1,
        expiresAt: new Date(Date.now() + 3600_000),
      })
      .returning();
    assert.equal(smSession.role, 'STORE_MANAGER');

    // Store schedule shift validation + uniqueness per (branch_code, schedule_date, agent_key)
    await assert.rejects(
      ctx.db.insert(storeSchedules).values({
        branchCode: '1750',
        scheduleDate: '2026-11-03',
        scheduleMonth: '2026-11',
        agentKey: 'SID-101',
        agentName: 'Agent One',
        sid: 'SID-101',
        shift: 'INVALID_SHIFT',
      })
    );

    await ctx.db.insert(storeSchedules).values({
      branchCode: '1750',
      scheduleDate: '2026-11-03',
      scheduleMonth: '2026-11',
      agentKey: 'SID-101',
      agentName: 'Agent One',
      sid: 'SID-101',
      shift: 'SUP AM',
    });

    await assert.rejects(
      ctx.db.insert(storeSchedules).values({
        branchCode: '1750',
        scheduleDate: '2026-11-03',
        scheduleMonth: '2026-11',
        agentKey: 'SID-101',
        agentName: 'Agent One',
        sid: 'SID-101',
        shift: 'PM',
      })
    );

    // Late opening distinguishes null (missing) from 0 and rejects negative delay
    await ctx.db.insert(lateOpenings).values([
      { branchCode: '1750', date: '2026-11-01', delayMinutes: null },
      { branchCode: '1750', date: '2026-11-02', delayMinutes: 0 },
    ]);
    await assert.rejects(
      ctx.db.insert(lateOpenings).values({
        branchCode: '1750',
        date: '2026-11-03',
        delayMinutes: -5,
      })
    );

    // Health weights must sum to 100
    await assert.rejects(
      ctx.db.insert(branchHealthConfigs).values({
        branchCode: '1750',
        dailyOperationsWeight: 30,
        salesPerformanceWeight: 25,
        teamPerformanceWeight: 20,
        customerExperienceWeight: 15,
        complianceAuditsWeight: 15,
      })
    );
    await ctx.db.insert(branchHealthConfigs).values({
      branchCode: '1750',
      dailyOperationsWeight: 25,
      salesPerformanceWeight: 25,
      teamPerformanceWeight: 20,
      customerExperienceWeight: 15,
      complianceAuditsWeight: 15,
    });

    // Rate limit atomic upsert
    await ctx.db
      .insert(rateLimits)
      .values({
        bucketKey: 'login:127.0.0.1:1750',
        scope: 'auth_login_branch',
        windowStart: new Date(),
        hitCount: 1,
      })
      .onConflictDoUpdate({
        target: rateLimits.bucketKey,
        set: { hitCount: 2 },
      });
    const [bucket] = await ctx.db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.bucketKey, 'login:127.0.0.1:1750'));
    assert.equal(bucket.hitCount, 1);
  });

  it('rolls back entire transaction on constraint violation and blocks UPDATE/DELETE/TRUNCATE on audit_log', async () => {
    ctx = await createMigratedTestDb();
    await seedVerifiedReferenceCatalog(ctx.db);

    await assert.rejects(
      ctx.db.transaction(async (tx) => {
        await tx.insert(actionPlans).values({
          branchCode: '1750',
          pillars: 'Acquisition',
          suggestedActions: 'Coaching follow-up',
        });
        // Trigger FK violation inside same transaction
        await tx.insert(storeTasks).values({
          branchCode: 'NON_EXISTENT_BRANCH',
          date: '2026-11-03',
          title: 'Should roll back',
        });
      })
    );

    const plans = await ctx.db.select().from(actionPlans);
    assert.equal(plans.length, 0);

    // Append-only audit_log permits INSERT and rejects UPDATE, DELETE, TRUNCATE
    const [entry] = await ctx.db
      .insert(auditLog)
      .values({
        actorType: 'SYSTEM_CLI',
        actorRole: null,
        actorIdentifier: 'phase2a_test',
        branchCode: '1750',
        action: 'TEST_EVENT',
        domain: 'audit_log',
        detailsJson: { verified: true },
      })
      .returning();

    assert.ok(entry.id >= 1);

    await assert.rejects(
      ctx.db.update(auditLog).set({ action: 'TAMPERED' }).where(eq(auditLog.id, entry.id))
    );
    await assert.rejects(ctx.db.delete(auditLog).where(eq(auditLog.id, entry.id)));
    await assert.rejects(ctx.client.query(`TRUNCATE TABLE "public"."audit_log"`));
  });
});
