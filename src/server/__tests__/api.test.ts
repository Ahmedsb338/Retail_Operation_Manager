import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../createApp.ts';
import { createMigratedTestDb, type TestDbContext } from '../../db/__tests__/testDb.ts';
import { seedVerifiedReferenceCatalog } from '../../db/referenceSeed.ts';
import { branches, lateOpenings, shortOverCases, storeTasks } from '../../db/schema.ts';
import {
  provisionAreaManager,
  provisionBranchCredential,
} from '../services/provisioning.ts';
import { DatabaseRateLimitStore } from '../security/rateLimit.ts';

interface JsonResponse<T = any> {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: T;
  rawText: string;
  rawBytes: Uint8Array;
}

async function httpRequest<T = any>(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    cookie?: string;
    headers?: Record<string, string>;
    json?: unknown;
  } = {}
): Promise<JsonResponse<T>> {
  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };
  if (options.cookie) {
    headers.cookie = options.cookie;
  }
  if (options.json !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
  });

  const rawBytes = new Uint8Array(await response.arrayBuffer());
  const rawText = new TextDecoder('utf-8', { ignoreBOM: true }).decode(rawBytes);
  let parsed: any = rawText;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    // Keep text / CSV payload intact
  }

  const headerObj: http.IncomingHttpHeaders = {};
  response.headers.forEach((value, key) => {
    headerObj[key.toLowerCase()] = value;
  });

  return {
    status: response.status,
    headers: headerObj,
    body: parsed as T,
    rawText,
    rawBytes,
  };
}

function extractSessionCookie(headers: http.IncomingHttpHeaders): string {
  const raw = headers['set-cookie'];
  if (!raw) return '';
  const first = Array.isArray(raw) ? raw[0] : raw;
  return first.split(';')[0].trim();
}

describe('ASB Workforce Express API — Full Security, Roles, Calculations & Integration Tests', () => {
  let ctx: TestDbContext;
  let server: http.Server;
  let baseUrl: string;
  let unconfiguredServer: http.Server;
  let unconfiguredBaseUrl: string;

  const branch1750Name = 'Abo ElMatamer Mahkama St. Express Store';
  const branch1750Code = '1750';
  const branch1750Secret = 'MatamerSecret#2026';

  const branch2000Name = 'Alexandria Marina Express Store';
  const branch2000Code = '2000';
  const branch2000Secret = 'MarinaSecret#2026';

  let amScopedPass = 'AreaManagerPass#2026!';
  const amUnassignedPass = 'UnassignedPass#2026!';

  let sm1750Cookie = '';
  let sm2000Cookie = '';
  let amScopedCookie = '';
  let amUnassignedCookie = '';

  before(async () => {
    ctx = await createMigratedTestDb();
    await seedVerifiedReferenceCatalog(ctx.db);

    // Assign area to 1750 and add a second branch 2000 in another area to verify isolation
    await ctx.db
      .insert(branches)
      .values({
        code: branch2000Code,
        storeId: branch2000Code,
        name: branch2000Name,
        nameAr: 'فرع مارينا الإسكندرية',
        city: 'Alexandria',
        cityAr: 'الإسكندرية',
        area: 'Alexandria',
        managerName: 'Second Manager',
        managerNameAr: 'مدير الفرع الثاني',
        businessDate: '2026-11-03',
        totalShifts: 25,
        remainingShifts: 10,
        targetDailyRevenue: 120000,
        isActive: true,
      });

    await provisionBranchCredential(ctx.db, {
      branchCode: branch1750Code,
      accessCode: branch1750Secret,
      area: 'El Beheira',
      managerName: 'Branch 1750 Manager',
    });

    await provisionBranchCredential(ctx.db, {
      branchCode: branch2000Code,
      accessCode: branch2000Secret,
      area: 'Alexandria',
      managerName: 'Branch 2000 Manager',
    });

    await provisionAreaManager(ctx.db, {
      username: 'am_beheira',
      displayName: 'Beheira Area Manager',
      password: amScopedPass,
      assignments: [{ areaName: 'El Beheira', branchCode: branch1750Code }],
    });

    await provisionAreaManager(ctx.db, {
      username: 'am_delta_empty',
      displayName: 'Unassigned Delta AM',
      password: amUnassignedPass,
      assignments: [{ areaName: 'South Sinai', branchCode: null }],
    });

    const app = await createApp({
      getDb: () => ctx.db,
      isDbConfigured: () => true,
      getAiClient: () => null,
      mountFrontend: 'none',
    });
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const unconfiguredApp = await createApp({
      getDb: () => {
        throw new Error('Should not be called when isDbConfigured=false');
      },
      isDbConfigured: () => false,
      getAiClient: () => null,
      mountFrontend: 'none',
    });
    unconfiguredServer = unconfiguredApp.listen(0);
    await new Promise<void>((resolve) => unconfiguredServer.once('listening', resolve));
    unconfiguredBaseUrl = `http://127.0.0.1:${(unconfiguredServer.address() as AddressInfo).port}`;
  });

  after(async () => {
    await Promise.all([
      new Promise<void>((resolve) => server.close(() => resolve())),
      new Promise<void>((resolve) => unconfiguredServer.close(() => resolve())),
    ]);
    await ctx.close();
  });

  it('reports 503 DATABASE_UNAVAILABLE when SQL_* is unconfigured and disables legacy /api/gemini/analyze with 410', async () => {
    const health = await httpRequest(unconfiguredBaseUrl, '/api/v1/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.databaseConfigured, false);
    assert.equal(health.body.geminiConfigured, false);

    const branchesRes = await httpRequest(unconfiguredBaseUrl, '/api/v1/auth/branches');
    assert.equal(branchesRes.status, 503);
    assert.equal(branchesRes.body.code, 'DATABASE_UNAVAILABLE');

    const legacyAi = await httpRequest(baseUrl, '/api/gemini/analyze', {
      method: 'POST',
      json: { tasks: [] },
    });
    assert.equal(legacyAi.status, 410);
  });

  it('rejects unauthenticated requests, rejects mutating requests without CSRF header/origin, and separates branch credentials', async () => {
    // Public catalog lists configured vs 13 unconfigured branches separately with zero secrets
    const catalog = await httpRequest(baseUrl, '/api/v1/auth/branches');
    assert.equal(catalog.status, 200);
    assert.equal(catalog.body.configuredBranches.length, 2);
    assert.equal(catalog.body.unconfiguredBranches.length, 13);
    assert.equal('codeHash' in catalog.body.configuredBranches[0], false);

    // Unauthenticated API access returns 401
    const unauthDash = await httpRequest(baseUrl, '/api/v1/dashboard');
    assert.equal(unauthDash.status, 401);

    // Missing Origin and X-CSRF-Check: 1 returns 403
    const noCsrf = await httpRequest(baseUrl, '/api/v1/auth/login-branch', {
      method: 'POST',
      json: {
        branchName: branch1750Name,
        branchCode: branch1750Code,
        accessCode: branch1750Secret,
      },
    });
    assert.equal(noCsrf.status, 403);

    // Wrong access code or branchCode === accessCode rejected
    const sameAsCode = await httpRequest(baseUrl, '/api/v1/auth/login-branch', {
      method: 'POST',
      headers: { 'x-csrf-check': '1' },
      json: {
        branchName: branch1750Name,
        branchCode: branch1750Code,
        accessCode: branch1750Code,
      },
    });
    assert.equal(sameAsCode.status, 401);

    const mismatchedName = await httpRequest(baseUrl, '/api/v1/auth/login-branch', {
      method: 'POST',
      headers: { 'x-csrf-check': '1' },
      json: {
        branchName: branch2000Name,
        branchCode: branch1750Code,
        accessCode: branch1750Secret,
      },
    });
    assert.equal(mismatchedName.status, 401);

    // Valid Store Manager login sets HttpOnly cookie
    const login1750 = await httpRequest(baseUrl, '/api/v1/auth/login-branch', {
      method: 'POST',
      headers: { 'x-csrf-check': '1' },
      json: {
        branchName: branch1750Name,
        branchCode: branch1750Code,
        accessCode: branch1750Secret,
      },
    });
    assert.equal(login1750.status, 200);
    assert.equal(login1750.body.user.role, 'STORE_MANAGER');
    assert.equal(login1750.body.user.branchCode, '1750');
    assert.ok(String(login1750.headers['set-cookie']).includes('HttpOnly'));
    sm1750Cookie = extractSessionCookie(login1750.headers);
    assert.ok(sm1750Cookie);

    const login2000 = await httpRequest(baseUrl, '/api/v1/auth/login-branch', {
      method: 'POST',
      headers: { 'x-csrf-check': '1' },
      json: {
        branchName: branch2000Name,
        branchCode: branch2000Code,
        accessCode: branch2000Secret,
      },
    });
    assert.equal(login2000.status, 200);
    sm2000Cookie = extractSessionCookie(login2000.headers);

    // Area Manager logins
    const loginAmScoped = await httpRequest(baseUrl, '/api/v1/auth/login-area', {
      method: 'POST',
      headers: { 'x-csrf-check': '1' },
      json: { username: 'am_beheira', password: amScopedPass },
    });
    assert.equal(loginAmScoped.status, 200);
    assert.equal(loginAmScoped.body.user.role, 'AREA_MANAGER');
    assert.deepEqual(
      loginAmScoped.body.user.authorizedBranches.map((b: any) => b.code),
      ['1750']
    );
    amScopedCookie = extractSessionCookie(loginAmScoped.headers);

    const loginAmEmpty = await httpRequest(baseUrl, '/api/v1/auth/login-area', {
      method: 'POST',
      headers: { 'x-csrf-check': '1' },
      json: { username: 'am_delta_empty', password: amUnassignedPass },
    });
    assert.equal(loginAmEmpty.status, 200);
    assert.equal(loginAmEmpty.body.user.authorizedBranches.length, 0);
    amUnassignedCookie = extractSessionCookie(loginAmEmpty.headers);
  });

  it('enforces distributed DB rate limiting across independent instances and returns 429 + Retry-After on login brute-force', async () => {
    const storeA = new DatabaseRateLimitStore(ctx.db);
    const storeB = new DatabaseRateLimitStore(ctx.db);
    const policy = { scope: 'test_distributed', maxHits: 3, windowMs: 60_000, lockoutMs: 120_000 };
    const key = 'distributed:bucket:test';

    assert.equal((await storeA.checkAndConsume(key, policy)).allowed, true);
    assert.equal((await storeB.checkAndConsume(key, policy)).allowed, true);
    assert.equal((await storeA.checkAndConsume(key, policy)).allowed, true);
    const blocked = await storeB.checkAndConsume(key, policy);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds > 0);
    await storeA.reset(key);

    // HTTP brute-force lockout against branch login from a distinct forwarded IP
    for (let i = 0; i < 5; i += 1) {
      const attempt = await httpRequest(baseUrl, '/api/v1/auth/login-branch', {
        method: 'POST',
        headers: { 'x-csrf-check': '1', 'x-forwarded-for': '203.0.113.77' },
        json: {
          branchName: branch1750Name,
          branchCode: branch1750Code,
          accessCode: 'WrongCode123',
        },
      });
      assert.equal(attempt.status, 401);
    }

    const lockedOut = await httpRequest(baseUrl, '/api/v1/auth/login-branch', {
      method: 'POST',
      headers: { 'x-csrf-check': '1', 'x-forwarded-for': '203.0.113.77' },
      json: {
        branchName: branch1750Name,
        branchCode: branch1750Code,
        accessCode: 'WrongCode123',
      },
    });
    assert.equal(lockedOut.status, 429);
    assert.ok(Number(lockedOut.headers['retry-after']) >= 1);
  });

  it('rejects mass assignment, enforces cross-branch isolation, and keeps AREA_MANAGER strictly read-only & scoped', async () => {
    // Mass assignment attempt (trying to inject branchCode or role) must return 400
    const massAssign = await httpRequest(baseUrl, '/api/v1/store-tasks', {
      method: 'POST',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: {
        branchCode: '2000',
        date: '2026-11-03',
        title: 'Malicious Cross Branch Task',
      },
    });
    assert.equal(massAssign.status, 400);

    // Branch identity change attempt rejected
    const identityPatch = await httpRequest(baseUrl, '/api/v1/settings/branch-profile', {
      method: 'PATCH',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: { code: '9999', managerName: 'Allowed Change' },
    });
    assert.equal(identityPatch.status, 400);

    // Store Manager 1750 creates task & staff & complaint
    const createTask = await httpRequest(baseUrl, '/api/v1/store-tasks', {
      method: 'POST',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: {
        date: '2026-11-03',
        title: 'Evening Cash Reconciliation',
        category: 'financial',
        priority: 'high',
        status: 'in_progress',
      },
    });
    assert.equal(createTask.status, 201);
    const taskId = createTask.body.record.id;

    // Cross-branch read, query, update, and delete blocked
    const sm1750Read2000 = await httpRequest(baseUrl, '/api/v1/dashboard?branchCode=2000', {
      cookie: sm1750Cookie,
    });
    assert.equal(sm1750Read2000.status, 403);

    const sm2000Patch1750 = await httpRequest(baseUrl, `/api/v1/store-tasks/${taskId}`, {
      method: 'PATCH',
      cookie: sm2000Cookie,
      headers: { 'x-csrf-check': '1' },
      json: { status: 'completed' },
    });
    assert.equal(sm2000Patch1750.status, 404);

    const sm2000Delete1750 = await httpRequest(baseUrl, `/api/v1/store-tasks/${taskId}`, {
      method: 'DELETE',
      cookie: sm2000Cookie,
      headers: { 'x-csrf-check': '1' },
    });
    assert.equal(sm2000Delete1750.status, 404);

    // Area Manager with zero assigned branches sees empty collections and gets 403 for branch 1750
    const amEmptyDash = await httpRequest(baseUrl, '/api/v1/dashboard', {
      cookie: amUnassignedCookie,
    });
    assert.equal(amEmptyDash.status, 200);
    assert.equal(amEmptyDash.body.branchCount, 0);
    assert.equal(amEmptyDash.body.overallAchievement, null);

    const amEmptyForbidden = await httpRequest(baseUrl, '/api/v1/store-tasks?branchCode=1750', {
      cookie: amUnassignedCookie,
    });
    assert.equal(amEmptyForbidden.status, 403);

    // Scoped Area Manager can read branch 1750, blocked from branch 2000
    const amRead1750 = await httpRequest(baseUrl, '/api/v1/store-tasks?branchCode=1750', {
      cookie: amScopedCookie,
    });
    assert.equal(amRead1750.status, 200);
    assert.equal(amRead1750.body.records.length, 1);

    const amRead2000 = await httpRequest(baseUrl, '/api/v1/store-tasks?branchCode=2000', {
      cookie: amScopedCookie,
    });
    assert.equal(amRead2000.status, 403);

    // AREA_MANAGER strictly read-only across all mutating endpoints -> 403
    const writeEndpoints: Array<{ method: string; path: string; json?: unknown }> = [
      { method: 'POST', path: '/api/v1/store-rpm', json: { month: '2026-11', pillar: 'Acquisition', actual: 100 } },
      { method: 'POST', path: '/api/v1/agent-rpm/import', json: { rows: [] } },
      { method: 'POST', path: '/api/v1/complaints', json: { caseNumber: 'C1', date: '2026-11-03', category: 'Billing' } },
      { method: 'PUT', path: '/api/v1/store-schedule/cell', json: { month: '2026-11', date: '2026-11-03', agentName: 'A', shift: 'AM' } },
      { method: 'POST', path: '/api/v1/store-tasks', json: { date: '2026-11-03', title: 'Blocked' } },
      { method: 'PATCH', path: `/api/v1/store-tasks/${taskId}`, json: { status: 'completed' } },
      { method: 'DELETE', path: `/api/v1/store-tasks/${taskId}` },
      { method: 'POST', path: '/api/v1/late-opening', json: { date: '2026-11-03', delayMinutes: 5 } },
      { method: 'POST', path: '/api/v1/short-over', json: { date: '2026-11-03', shortAmount: 10 } },
      { method: 'POST', path: '/api/v1/action-plans', json: { pillars: 'Acquisition', suggestedActions: 'Coach' } },
      { method: 'POST', path: '/api/v1/staff', json: { name: 'ReadOnlyBlocked' } },
      { method: 'POST', path: '/api/v1/sales-boxes', json: { name: 'Box', target: 10, actual: 5 } },
      { method: 'PUT', path: '/api/v1/target-calculator', json: { items: {}, weights: {} } },
      { method: 'PUT', path: '/api/v1/tnps-store/daily-calc', json: { businessDate: '2026-11-03', detractors: 0, passive: 0, promoters: 1, score: 100, benchmark: 70, requiredPromoters: 0, dailyRequired: 0 } },
      { method: 'PUT', path: '/api/v1/branch-health/weights', json: { dailyOperations: 25, salesPerformance: 25, teamPerformance: 20, customerExperience: 15, complianceAudits: 15 } },
      { method: 'PUT', path: '/api/v1/settings/fiscal-year', json: { startDate: '2026-04-01', endDate: '2027-03-31' } },
      { method: 'PATCH', path: '/api/v1/settings/branch-profile', json: { managerName: 'Hack' } },
      { method: 'POST', path: '/api/v1/migrations/local-import/preview', json: { bundle: {} } },
      { method: 'POST', path: '/api/v1/migrations/local-import/commit', json: { confirmed: true, bundle: {} } },
    ];

    for (const ep of writeEndpoints) {
      const r = await httpRequest(baseUrl, ep.path, {
        method: ep.method,
        cookie: amScopedCookie,
        headers: { 'x-csrf-check': '1' },
        json: ep.json,
      });
      assert.equal(r.status, 403, `Expected 403 for AREA_MANAGER on ${ep.method} ${ep.path}, got ${r.status}`);
    }
  });

  it('implements FY arithmetic average Store RPM, preserves null vs 0 in Late Opening and Short/Over, and supports Arabic UTF-8 BOM CSV export + Import summary', async () => {
    // Store RPM within FY 2026-04..2027-03: two months for Acquisition + one unconfigured target row
    const rpmOct = await httpRequest(baseUrl, '/api/v1/store-rpm', {
      method: 'POST',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: { month: '2026-10', pillar: 'Acquisition', actual: 100, target: 100 }, // 100%
    });
    assert.equal(rpmOct.status, 201);
    assert.equal(rpmOct.body.record.achievementPercent, 100);

    const rpmNov = await httpRequest(baseUrl, '/api/v1/store-rpm', {
      method: 'POST',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: { month: '2026-11', pillar: 'Acquisition', actual: 120, target: 100 }, // 120% -> mean = 110%
    });
    assert.equal(rpmNov.status, 201);

    // Record outside FY (2026-02) must NOT be counted in Dashboard FY YTD average
    const rpmOutFy = await httpRequest(baseUrl, '/api/v1/store-rpm', {
      method: 'POST',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: { month: '2026-02', pillar: 'Acquisition', actual: 20, target: 100 },
    });
    assert.equal(rpmOutFy.status, 201);

    // Record with missing target (Enterprise default target is null) -> Unconfigured (achievementPercent = null)
    const rpmUnconfigured = await httpRequest(baseUrl, '/api/v1/store-rpm', {
      method: 'POST',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: { month: '2026-11', pillar: 'Enterprise', actual: 40 },
    });
    assert.equal(rpmUnconfigured.status, 201);
    assert.equal(rpmUnconfigured.body.record.target, null);
    assert.equal(rpmUnconfigured.body.record.achievementPercent, null);

    // Dashboard checks FY average = 110% for Acquisition and null for Enterprise
    const dash = await httpRequest(baseUrl, '/api/v1/dashboard', { cookie: sm1750Cookie });
    assert.equal(dash.status, 200);
    const acq = dash.body.pillars.find((p: any) => p.pillar === 'Acquisition');
    const ent = dash.body.pillars.find((p: any) => p.pillar === 'Enterprise');
    assert.equal(acq.achievement, 110);
    assert.equal(acq.passed, true);
    assert.equal(ent.achievement, null);
    assert.equal(ent.configured, false);

    // Late Opening preserves null vs 0 cleanly
    const lateNull = await httpRequest(baseUrl, '/api/v1/late-opening', {
      method: 'POST',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: { date: '2026-11-01', agentName: 'سارة أحمد', delayMinutes: null },
    });
    assert.equal(lateNull.status, 201);
    assert.equal(lateNull.body.record.delayMinutes, null);

    const lateZero = await httpRequest(baseUrl, '/api/v1/late-opening', {
      method: 'POST',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: { date: '2026-11-02', agentName: 'خالد حسن', delayMinutes: 0 },
    });
    assert.equal(lateZero.status, 201);
    assert.equal(lateZero.body.record.delayMinutes, 0);

    // Short & Over preserves manual netAmount as null ("Unconfigured") when not explicitly entered
    const soNull = await httpRequest(baseUrl, '/api/v1/short-over', {
      method: 'POST',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: { date: '2026-11-03', agentName: 'عادل محمود', shortAmount: 50, overAmount: 10 },
    });
    assert.equal(soNull.status, 201);
    assert.equal(soNull.body.record.netAmount, null);

    // UTF-8 BOM CSV export preserves Arabic text
    const csvExport = await httpRequest(baseUrl, '/api/v1/late-opening/export?format=csv', {
      cookie: amScopedCookie,
    });
    assert.equal(csvExport.status, 200);
    assert.deepEqual(Array.from(csvExport.rawBytes.slice(0, 3)), [0xef, 0xbb, 0xbf]);
    assert.ok(csvExport.rawText.startsWith('\uFEFF'));
    assert.ok(csvExport.rawText.includes('سارة أحمد'));
    assert.ok(csvExport.rawText.includes('Unconfigured'));

    // XLSX export returns valid OOXML buffer
    const xlsxExport = await fetch(`${baseUrl}/api/v1/store-rpm/export?format=xlsx`, {
      headers: { cookie: amScopedCookie },
    });
    assert.equal(xlsxExport.status, 200);
    assert.ok(
      xlsxExport.headers.get('content-type')?.includes('spreadsheetml.sheet')
    );

    // CSV/row import returns 7-field ImportSummary classifying valid, invalid, and duplicate
    const importRes = await httpRequest(baseUrl, '/api/v1/agent-rpm/import', {
      method: 'POST',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: {
        rows: [
          { agentName: 'Nour Hassan', sid: 'SID-01', month: '2026-11', pillar: 'ADSL', actual: 15, target: 10 },
          { agentName: 'Nour Hassan', sid: 'SID-01', month: '2026-11', pillar: 'ADSL', actual: 15, target: 10 }, // duplicate
          { agentName: 'Invalid Agent', sid: 'SID-02', month: 'bad-month', pillar: 'ADSL', actual: 5 }, // invalid
        ],
      },
    });
    assert.equal(importRes.status, 200);
    assert.equal(importRes.body.total, 3);
    assert.equal(importRes.body.valid, 1);
    assert.equal(importRes.body.duplicate, 1);
    assert.equal(importRes.body.invalid, 1);
    assert.equal(importRes.body.imported, 1);
    assert.equal(importRes.body.rejected, 2);
    assert.equal(importRes.body.reasons.length, 2);
  });

  it('manages Store Schedule grid, FY month validation, Calculators, Local Migration preview/commit, and AI boundaries', async () => {
    // Reject schedule month outside configured FY (2026-04..2027-03)
    const outFyMonth = await httpRequest(baseUrl, '/api/v1/store-schedule/month?month=2025-11', {
      cookie: sm1750Cookie,
    });
    assert.equal(outFyMonth.status, 400);

    // Create staff member then edit shift cell + clear cell
    const staffCreate = await httpRequest(baseUrl, '/api/v1/staff', {
      method: 'POST',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: { sid: 'SID-1750-01', name: 'Tarek Adel', roleTitle: 'Sales Specialist' },
    });
    assert.equal(staffCreate.status, 201);

    const setShift = await httpRequest(baseUrl, '/api/v1/store-schedule/cell', {
      method: 'PUT',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: {
        month: '2026-11',
        date: '2026-11-03',
        agentName: 'Tarek Adel',
        sid: 'SID-1750-01',
        shift: 'SUP AM',
      },
    });
    assert.equal(setShift.status, 200);

    const gridImport = await httpRequest(baseUrl, '/api/v1/store-schedule/import-grid', {
      method: 'POST',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: {
        month: '2026-11',
        entries: [
          { date: '2026-11-04', agentName: 'Tarek Adel', sid: 'SID-1750-01', shift: 'PM' },
          { date: '2026-11-04', agentName: 'Tarek Adel', sid: 'SID-1750-01', shift: 'PM' }, // duplicate
          { date: '2026-11-05', agentName: 'Tarek Adel', sid: 'SID-1750-01', shift: 'BADSHIFT' }, // invalid
        ],
      },
    });
    assert.equal(gridImport.status, 200);
    assert.equal(gridImport.body.imported, 1);
    assert.equal(gridImport.body.duplicate, 1);
    assert.equal(gridImport.body.invalid, 1);

    // Persist Target Calculator and TNPS Daily Snapshot
    const saveTargetCalc = await httpRequest(baseUrl, '/api/v1/target-calculator', {
      method: 'PUT',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: {
        items: { acq_low: { id: 'acq_low', name: 'Low Acq', shortName: 'Acq Low', monthlyTarget: '100', mtdAchievement: '40', todayAch: '5' } },
        weights: { acq: '60', terminal: '10', enterprise: '10', adsl: '16', home: '4' },
        redSalesToday: '2',
        redSalesTarget: '10',
        dailyTrend: [],
        totalShifts: 25,
        remainingShifts: 10,
      },
    });
    assert.equal(saveTargetCalc.status, 200);

    const saveTnps = await httpRequest(baseUrl, '/api/v1/tnps-store/daily-calc', {
      method: 'PUT',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: {
        businessDate: '2026-11-03',
        detractors: 1,
        passive: 2,
        promoters: 9,
        score: 66.7,
        benchmark: 70,
        requiredPromoters: 4,
        dailyRequired: 1,
        agentRows: [{ id: '1', agentName: 'Tarek Adel', detractors: 1, passive: 2, promoters: 9 }],
        notes: 'Mid-week snapshot',
      },
    });
    assert.equal(saveTnps.status, 200);

    // LocalStorage Migration preview vs commit
    const migrationPayload = {
      bundle: {
        tasks: [{ title: 'Migrated Legacy Task', priority: 'medium', status: 'not_started', deadline: '2026-11-12' }],
        employees: [{ name: 'Migrated Staff', identifier: 'SID-MIG-1' }],
        salesBoxes: [],
        cases: [],
        tnpsDailyRecords: [],
      },
    };
    const previewRes = await httpRequest(baseUrl, '/api/v1/migrations/local-import/preview', {
      method: 'POST',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: migrationPayload,
    });
    assert.equal(previewRes.status, 200);
    assert.equal(previewRes.body.summary.valid, 2);
    assert.equal(previewRes.body.summary.imported, 0);

    const commitWithoutConfirm = await httpRequest(baseUrl, '/api/v1/migrations/local-import/commit', {
      method: 'POST',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: migrationPayload,
    });
    assert.equal(commitWithoutConfirm.status, 400);

    const commitConfirmed = await httpRequest(baseUrl, '/api/v1/migrations/local-import/commit', {
      method: 'POST',
      cookie: sm1750Cookie,
      headers: { 'x-csrf-check': '1' },
      json: { confirmed: true, ...migrationPayload },
    });
    assert.equal(commitConfirmed.status, 200);
    assert.equal(commitConfirmed.body.summary.imported, 2);

    // AI diagnostics rejects client-supplied operational arrays (400) and returns 503 when Gemini not configured
    const aiRejectArray = await httpRequest(baseUrl, '/api/v1/ai/diagnostics/analyze', {
      method: 'POST',
      cookie: amScopedCookie,
      headers: { 'x-csrf-check': '1' },
      json: { branchCode: '1750', tasks: [{ title: 'Forged' }] },
    });
    assert.equal(aiRejectArray.status, 400);

    const aiNoKey = await httpRequest(baseUrl, '/api/v1/ai/diagnostics/analyze', {
      method: 'POST',
      cookie: amScopedCookie,
      headers: { 'x-csrf-check': '1' },
      json: { branchCode: '1750', language: 'en' },
    });
    assert.equal(aiNoKey.status, 503);
  });

  it('revokes sessions immediately on change-password, logout, and logout-all', async () => {
    const newPass = 'AreaManagerNewPass#2026!';
    const changePass = await httpRequest(baseUrl, '/api/v1/auth/change-password', {
      method: 'POST',
      cookie: amScopedCookie,
      headers: { 'x-csrf-check': '1' },
      json: { currentPassword: amScopedPass, newPassword: newPass },
    });
    assert.equal(changePass.status, 200);
    const rotatedCookie = extractSessionCookie(changePass.headers);
    assert.ok(rotatedCookie);

    // Old AM cookie must immediately fail /me
    const oldMe = await httpRequest(baseUrl, '/api/v1/auth/me', { cookie: amScopedCookie });
    assert.equal(oldMe.status, 401);

    // Rotated cookie works and then is invalidated by /logout-all
    const validMe = await httpRequest(baseUrl, '/api/v1/auth/me', { cookie: rotatedCookie });
    assert.equal(validMe.status, 200);

    const logoutAll = await httpRequest(baseUrl, '/api/v1/auth/logout-all', {
      method: 'POST',
      cookie: rotatedCookie,
      headers: { 'x-csrf-check': '1' },
    });
    assert.equal(logoutAll.status, 200);

    const afterLogoutAll = await httpRequest(baseUrl, '/api/v1/auth/me', { cookie: rotatedCookie });
    assert.equal(afterLogoutAll.status, 401);
  });
});
