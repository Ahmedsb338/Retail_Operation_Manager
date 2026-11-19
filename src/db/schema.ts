import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ============================================================================
// 1. TWO FIXED APPLICATION ROLES (NO ADDITIONAL ROLES)
// ============================================================================
export const appRoleEnum = pgEnum('app_role', ['STORE_MANAGER', 'AREA_MANAGER']);

export type AppRole = (typeof appRoleEnum.enumValues)[number];

// ============================================================================
// 2. BRANCH IDENTITY, UNCONFIGURED CATALOG, AND SEPARATED CREDENTIALS
// ============================================================================
export const branches = pgTable(
  'branches',
  {
    code: text('code').primaryKey(),
    storeId: text('store_id').notNull().unique(),
    name: text('name').notNull().unique(),
    nameAr: text('name_ar').notNull().default(''),
    city: text('city').notNull().default(''),
    cityAr: text('city_ar').notNull().default(''),
    managerName: text('manager_name').notNull().default(''),
    managerNameAr: text('manager_name_ar').notNull().default(''),
    area: text('area').notNull().default(''),
    businessDate: text('business_date').notNull().default(''),
    totalShifts: integer('total_shifts').notNull().default(25),
    remainingShifts: integer('remaining_shifts').notNull().default(10),
    targetDailyRevenue: doublePrecision('target_daily_revenue').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('branches_store_id_equals_code', sql`${table.storeId} = ${table.code}`),
    index('idx_branches_area').on(table.area),
    index('idx_branches_active').on(table.isActive),
  ]
);

export const unconfiguredBranches = pgTable(
  'unconfigured_branches',
  {
    id: serial('id').primaryKey(),
    branchName: text('branch_name').notNull().unique(),
    displayOrder: integer('display_order').notNull(),
    statusNote: text('status_note')
      .notNull()
      .default('Unconfigured — awaiting verified Branch Code, Manager Name, and Area'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_unconfigured_branches_order').on(table.displayOrder)]
);

export const branchCredentials = pgTable(
  'branch_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .unique()
      .references(() => branches.code, { onDelete: 'restrict' }),
    codeHash: text('code_hash').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    tokenVersion: integer('token_version').notNull().default(1),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastRotatedAt: timestamp('last_rotated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_branch_credentials_active').on(table.isActive)]
);

// ============================================================================
// 3. AREA MANAGERS & EXPLICIT DATABASE-BACKED ASSIGNMENTS (NO "ALL" SHORTCUT)
// ============================================================================
export const areaManagers = pgTable(
  'area_managers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: text('username').notNull().unique(),
    usernameNormalized: text('username_normalized').notNull().unique(),
    displayName: text('display_name').notNull(),
    role: appRoleEnum('role').notNull().default('AREA_MANAGER'),
    passwordHash: text('password_hash').notNull(),
    mustRotatePassword: boolean('must_rotate_password').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    tokenVersion: integer('token_version').notNull().default(1),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('area_managers_role_locked', sql`${table.role} = 'AREA_MANAGER'`),
    index('idx_area_managers_active').on(table.isActive),
  ]
);

export const areaManagerAssignments = pgTable(
  'area_manager_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    areaManagerId: uuid('area_manager_id')
      .notNull()
      .references(() => areaManagers.id, { onDelete: 'cascade' }),
    areaName: text('area_name').notNull(),
    branchCode: text('branch_code').references(() => branches.code, { onDelete: 'restrict' }),
    isActive: boolean('is_active').notNull().default(true),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'assignments_no_all_wildcard',
      sql`length(trim(${table.areaName})) > 0 AND upper(trim(${table.areaName})) NOT IN ('ALL', '*', 'ANY')`
    ),
    uniqueIndex('uq_area_assignment_area_only')
      .on(table.areaManagerId, table.areaName)
      .where(sql`${table.branchCode} IS NULL AND ${table.isActive} = true`),
    uniqueIndex('uq_area_assignment_branch')
      .on(table.areaManagerId, table.branchCode)
      .where(sql`${table.branchCode} IS NOT NULL AND ${table.isActive} = true`),
    index('idx_assignments_manager_active').on(table.areaManagerId, table.isActive),
    index('idx_assignments_area_name').on(table.areaName),
  ]
);

// ============================================================================
// 4. SHARED SESSIONS, DISTRIBUTED RATE LIMITING & APPEND-ONLY AUDIT LOG
// ============================================================================
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: text('token_hash').notNull().unique(),
    role: appRoleEnum('role').notNull(),
    branchCode: text('branch_code').references(() => branches.code, { onDelete: 'restrict' }),
    areaManagerId: uuid('area_manager_id').references(() => areaManagers.id, { onDelete: 'cascade' }),
    tokenVersion: integer('token_version').notNull(),
    ipAddress: text('ip_address').notNull().default(''),
    userAgent: text('user_agent').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'sessions_principal_binding',
      sql`(${table.role} = 'STORE_MANAGER' AND ${table.branchCode} IS NOT NULL AND ${table.areaManagerId} IS NULL) OR (${table.role} = 'AREA_MANAGER' AND ${table.areaManagerId} IS NOT NULL AND ${table.branchCode} IS NULL)`
    ),
    index('idx_sessions_branch_code').on(table.branchCode),
    index('idx_sessions_area_manager_id').on(table.areaManagerId),
    index('idx_sessions_expires_at').on(table.expiresAt),
  ]
);

export const rateLimits = pgTable(
  'rate_limits',
  {
    bucketKey: text('bucket_key').primaryKey(),
    scope: text('scope').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    hitCount: integer('hit_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_rate_limits_scope_window').on(table.scope, table.windowStart)]
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    actorType: text('actor_type').notNull(),
    actorRole: appRoleEnum('actor_role'),
    actorIdentifier: text('actor_identifier').notNull(),
    branchCode: text('branch_code'),
    action: text('action').notNull(),
    domain: text('domain').notNull(),
    recordId: text('record_id'),
    detailsJson: jsonb('details_json').$type<Record<string, unknown>>(),
    ipAddress: text('ip_address').notNull().default(''),
  },
  (table) => [
    check(
      'audit_log_actor_type_valid',
      sql`${table.actorType} IN ('STORE_MANAGER', 'AREA_MANAGER', 'ANONYMOUS', 'SYSTEM_CLI')`
    ),
    index('idx_audit_log_occurred_at').on(table.occurredAt),
    index('idx_audit_log_branch_domain').on(table.branchCode, table.domain),
    index('idx_audit_log_action').on(table.action),
  ]
);

// ============================================================================
// 5. SYSTEM CONFIGURATION & PILLAR TARGETS
// ============================================================================
export const systemConfigs = pgTable('system_configs', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pillarTargets = pgTable('pillar_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  pillar: text('pillar').notNull().unique(),
  monthlyTarget: doublePrecision('monthly_target'),
  unit: text('unit').notNull().default('%'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 6. UNIFIED STAFF ROSTER & COACHING
// ============================================================================
export const staffMembers = pgTable(
  'staff_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    sid: text('sid').notNull().default(''),
    name: text('name').notNull(),
    nameAr: text('name_ar').notNull().default(''),
    roleTitle: text('role_title').notNull().default(''),
    roleTitleAr: text('role_title_ar').notNull().default(''),
    productKnowledgeScore: integer('product_knowledge_score'),
    productivityScore: integer('productivity_score'),
    customerExperienceScore: integer('customer_experience_score'),
    coachingStatus: text('coaching_status').notNull().default('needs_coaching'),
    developmentAreas: jsonb('development_areas').$type<string[]>().notNull().default([]),
    coachingNotes: text('coaching_notes').notNull().default(''),
    agreedActions: text('agreed_actions').notNull().default(''),
    assignedCoach: text('assigned_coach').notNull().default(''),
    followUpDate: text('follow_up_date').notNull().default(''),
    progressStatus: text('progress_status').notNull().default('pending'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_staff_branch_sid')
      .on(table.branchCode, table.sid)
      .where(sql`${table.sid} <> ''`),
    index('idx_staff_branch_name').on(table.branchCode, table.name),
  ]
);

export const coachingSessions = pgTable(
  'coaching_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    staffMemberId: uuid('staff_member_id')
      .notNull()
      .references(() => staffMembers.id, { onDelete: 'cascade' }),
    sessionDate: text('session_date').notNull(),
    coach: text('coach').notNull(),
    topic: text('topic').notNull(),
    agreedActions: text('agreed_actions').notNull().default(''),
    scoreImprovement: text('score_improvement').notNull().default(''),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_coaching_branch_staff').on(table.branchCode, table.staffMemberId),
    index('idx_coaching_date').on(table.sessionDate),
  ]
);

// ============================================================================
// 7. PERFORMANCE METRICS (STORE & AGENT RPM, KPIs, TNPS)
// ============================================================================
export const storeRpmRecords = pgTable(
  'store_rpm_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    month: text('month').notNull(),
    pillar: text('pillar').notNull(),
    actual: doublePrecision('actual'),
    target: doublePrecision('target'),
    achievementPercent: doublePrecision('achievement_percent'),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_store_rpm_branch_month_pillar').on(table.branchCode, table.month, table.pillar),
    index('idx_store_rpm_branch_month').on(table.branchCode, table.month),
  ]
);

export const agentRpmRecords = pgTable(
  'agent_rpm_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    staffMemberId: uuid('staff_member_id').references(() => staffMembers.id, { onDelete: 'set null' }),
    agentName: text('agent_name').notNull(),
    sid: text('sid').notNull().default(''),
    month: text('month').notNull(),
    pillar: text('pillar').notNull(),
    actual: doublePrecision('actual'),
    target: doublePrecision('target'),
    achievementPercent: doublePrecision('achievement_percent'),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_agent_rpm_branch_month_pillar').on(table.branchCode, table.month, table.pillar),
    index('idx_agent_rpm_branch_sid').on(table.branchCode, table.sid),
  ]
);

export const storeKpiRecords = pgTable(
  'store_kpi_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    month: text('month').notNull(),
    kpiName: text('kpi_name').notNull(),
    actual: doublePrecision('actual'),
    target: doublePrecision('target'),
    achievementPercent: doublePrecision('achievement_percent'),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_store_kpi_branch_month_name').on(table.branchCode, table.month, table.kpiName),
    index('idx_store_kpi_branch_month').on(table.branchCode, table.month),
  ]
);

export const agentKpiRecords = pgTable(
  'agent_kpi_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    staffMemberId: uuid('staff_member_id').references(() => staffMembers.id, { onDelete: 'set null' }),
    agentName: text('agent_name').notNull(),
    sid: text('sid').notNull().default(''),
    month: text('month').notNull(),
    kpiName: text('kpi_name').notNull(),
    actual: doublePrecision('actual'),
    target: doublePrecision('target'),
    achievementPercent: doublePrecision('achievement_percent'),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_agent_kpi_branch_month_name').on(table.branchCode, table.month, table.kpiName),
    index('idx_agent_kpi_branch_sid').on(table.branchCode, table.sid),
  ]
);

export const tnpsStoreRecords = pgTable(
  'tnps_store_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    recordType: text('record_type').notNull().default('monthly_log'),
    month: text('month').notNull(),
    businessDate: text('business_date').notNull().default(''),
    agentName: text('agent_name').notNull().default(''),
    detractors: integer('detractors'),
    passive: integer('passive'),
    promoters: integer('promoters'),
    score: doublePrecision('score'),
    benchmark: doublePrecision('benchmark'),
    achievementPercent: doublePrecision('achievement_percent'),
    requiredPromoters: integer('required_promoters'),
    dailyRequired: integer('daily_required'),
    agentRowsJson: jsonb('agent_rows_json').$type<Array<Record<string, unknown>>>(),
    revisionNumber: integer('revision_number').notNull().default(1),
    updatedBy: text('updated_by').notNull().default(''),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('tnps_store_record_type_valid', sql`${table.recordType} IN ('monthly_log', 'daily_calc')`),
    uniqueIndex('uq_tnps_store_daily_calc')
      .on(table.branchCode, table.businessDate)
      .where(sql`${table.recordType} = 'daily_calc' AND ${table.businessDate} <> ''`),
    index('idx_tnps_store_branch_month').on(table.branchCode, table.month),
  ]
);

export const tnpsAgentRecords = pgTable(
  'tnps_agent_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    staffMemberId: uuid('staff_member_id').references(() => staffMembers.id, { onDelete: 'set null' }),
    agentName: text('agent_name').notNull(),
    sid: text('sid').notNull().default(''),
    month: text('month').notNull(),
    score: doublePrecision('score'),
    benchmark: doublePrecision('benchmark'),
    achievementPercent: doublePrecision('achievement_percent'),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_tnps_agent_branch_month').on(table.branchCode, table.month),
    index('idx_tnps_agent_branch_sid').on(table.branchCode, table.sid),
  ]
);

// ============================================================================
// 8. COMPLAINTS, SCHEDULES, TASKS, COMPLIANCE & ACTION PLANS
// ============================================================================
export const complaints = pgTable(
  'complaints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    staffMemberId: uuid('staff_member_id').references(() => staffMembers.id, { onDelete: 'set null' }),
    agentName: text('agent_name').notNull().default(''),
    caseNumber: text('case_number').notNull(),
    customerIdentifier: text('customer_identifier').notNull().default(''),
    date: text('date').notNull(),
    category: text('category').notNull(),
    categoryAr: text('category_ar').notNull().default(''),
    description: text('description').notNull().default(''),
    isRepeated: boolean('is_repeated').notNull().default(false),
    repeatedMatchCriteria: text('repeated_match_criteria').notNull().default(''),
    rootCause: text('root_cause').notNull().default(''),
    rootCauseAr: text('root_cause_ar').notNull().default(''),
    assignedOwner: text('assigned_owner').notNull().default(''),
    resolutionDeadline: text('resolution_deadline').notNull().default(''),
    status: text('status').notNull().default('pending'),
    correctiveAction: text('corrective_action').notNull().default(''),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_complaints_branch_case_number').on(table.branchCode, table.caseNumber),
    index('idx_complaints_branch_date_status').on(table.branchCode, table.date, table.status),
  ]
);

export const storeSchedules = pgTable(
  'store_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    staffMemberId: uuid('staff_member_id').references(() => staffMembers.id, { onDelete: 'set null' }),
    scheduleDate: text('schedule_date').notNull(),
    scheduleMonth: text('schedule_month').notNull(),
    agentKey: text('agent_key').notNull(),
    agentName: text('agent_name').notNull(),
    sid: text('sid').notNull().default(''),
    shift: text('shift').notNull(),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('store_schedules_valid_shift', sql`${table.shift} IN ('AM', 'PM', 'SUP AM', 'SUP PM', 'FULL', 'OFF')`),
    uniqueIndex('uq_store_schedules_cell').on(table.branchCode, table.scheduleDate, table.agentKey),
    index('idx_store_schedules_branch_month').on(table.branchCode, table.scheduleMonth),
  ]
);

export const scheduleExceptions = pgTable(
  'schedule_exceptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    staffMemberId: uuid('staff_member_id').references(() => staffMembers.id, { onDelete: 'set null' }),
    agentName: text('agent_name').notNull(),
    date: text('date').notNull(),
    exceptionType: text('exception_type').notNull(),
    reason: text('reason').notNull().default(''),
    approvedBy: text('approved_by').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_schedule_exceptions_branch_date').on(table.branchCode, table.date)]
);

export const storeTasks = pgTable(
  'store_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    staffMemberId: uuid('staff_member_id').references(() => staffMembers.id, { onDelete: 'set null' }),
    agentName: text('agent_name').notNull().default(''),
    date: text('date').notNull(),
    title: text('title').notNull(),
    titleAr: text('title_ar').notNull().default(''),
    description: text('description').notNull().default(''),
    descriptionAr: text('description_ar').notNull().default(''),
    category: text('category').notNull().default('store'),
    subcategory: text('subcategory').notNull().default(''),
    owner: text('owner').notNull().default(''),
    ownerRole: text('owner_role').notNull().default(''),
    priority: text('priority').notNull().default('medium'),
    status: text('status').notNull().default('not_started'),
    dueDate: text('due_date').notNull().default(''),
    notes: text('notes').notNull().default(''),
    evidenceText: text('evidence_text').notNull().default(''),
    historyJson: jsonb('history_json').$type<Array<Record<string, unknown>>>().notNull().default([]),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_store_tasks_branch_status_due').on(table.branchCode, table.status, table.dueDate),
    index('idx_store_tasks_branch_date').on(table.branchCode, table.date),
  ]
);

export const hrActions = pgTable(
  'hr_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    staffMemberId: uuid('staff_member_id').references(() => staffMembers.id, { onDelete: 'set null' }),
    agentName: text('agent_name').notNull(),
    date: text('date').notNull(),
    action: text('action').notNull(),
    status: text('status').notNull(),
    owner: text('owner').notNull().default(''),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_hr_actions_branch_date').on(table.branchCode, table.date)]
);

export const lateOpenings = pgTable(
  'late_opening',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    staffMemberId: uuid('staff_member_id').references(() => staffMembers.id, { onDelete: 'set null' }),
    agentName: text('agent_name').notNull().default(''),
    date: text('date').notNull(),
    plannedOpening: text('planned_opening').notNull().default(''),
    actualOpening: text('actual_opening').notNull().default(''),
    delayMinutes: integer('delay_minutes'),
    reason: text('reason').notNull().default(''),
    responsible: text('responsible').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('late_opening_delay_non_negative', sql`${table.delayMinutes} IS NULL OR ${table.delayMinutes} >= 0`),
    index('idx_late_opening_branch_date').on(table.branchCode, table.date),
  ]
);

export const shortOverCases = pgTable(
  'short_over',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    staffMemberId: uuid('staff_member_id').references(() => staffMembers.id, { onDelete: 'set null' }),
    agentName: text('agent_name').notNull().default(''),
    date: text('date').notNull(),
    shortAmount: doublePrecision('short_amount'),
    overAmount: doublePrecision('over_amount'),
    netAmount: doublePrecision('net_amount'),
    remarks: text('remarks').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_short_over_branch_date').on(table.branchCode, table.date)]
);

export const actionPlans = pgTable(
  'action_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    staffMemberId: uuid('staff_member_id').references(() => staffMembers.id, { onDelete: 'set null' }),
    agentName: text('agent_name').notNull().default(''),
    pillars: text('pillars').notNull(),
    reason: text('reason').notNull().default(''),
    suggestedActions: text('suggested_actions').notNull(),
    owner: text('owner').notNull().default(''),
    startDate: text('start_date').notNull().default(''),
    dueDate: text('due_date').notNull().default(''),
    status: text('status').notNull().default('open'),
    beforeTracking: text('before_tracking').notNull().default(''),
    afterTracking: text('after_tracking').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_action_plans_branch_dates').on(table.branchCode, table.startDate, table.dueDate),
    index('idx_action_plans_branch_status').on(table.branchCode, table.status),
  ]
);

// ============================================================================
// 9. SALES BOXES, CALCULATOR STATE, BRANCH HEALTH WEIGHTS & AI DIAGNOSTICS
// ============================================================================
export const salesBoxes = pgTable(
  'sales_boxes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    boxKey: text('box_key').notNull(),
    name: text('name').notNull(),
    nameAr: text('name_ar').notNull().default(''),
    target: doublePrecision('target').notNull().default(0),
    actual: doublePrecision('actual').notNull().default(0),
    unit: text('unit').notNull().default(''),
    unitAr: text('unit_ar').notNull().default(''),
    remainingWorkingDays: integer('remaining_working_days').notNull().default(0),
    trend: text('trend').notNull().default('stable'),
    dailyHistoryJson: jsonb('daily_history_json').$type<Array<Record<string, unknown>>>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_sales_boxes_branch_key').on(table.branchCode, table.boxKey)]
);

export const targetCalculatorStates = pgTable('target_calculator_states', {
  branchCode: text('branch_code')
    .primaryKey()
    .references(() => branches.code, { onDelete: 'restrict' }),
  itemsJson: jsonb('items_json').$type<Record<string, unknown>>().notNull(),
  weightsJson: jsonb('weights_json').$type<Record<string, unknown>>().notNull(),
  redSalesToday: text('red_sales_today').notNull().default('0'),
  redSalesTarget: text('red_sales_target').notNull().default('0'),
  dailyTrendJson: jsonb('daily_trend_json').$type<Array<Record<string, unknown>>>().notNull().default([]),
  totalShifts: integer('total_shifts').notNull().default(25),
  remainingShifts: integer('remaining_shifts').notNull().default(10),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const branchHealthConfigs = pgTable(
  'branch_health_configs',
  {
    branchCode: text('branch_code')
      .primaryKey()
      .references(() => branches.code, { onDelete: 'restrict' }),
    dailyOperationsWeight: integer('daily_operations_weight').notNull().default(25),
    salesPerformanceWeight: integer('sales_performance_weight').notNull().default(25),
    teamPerformanceWeight: integer('team_performance_weight').notNull().default(20),
    customerExperienceWeight: integer('customer_experience_weight').notNull().default(15),
    complianceAuditsWeight: integer('compliance_audits_weight').notNull().default(15),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'branch_health_weights_sum_100',
      sql`(${table.dailyOperationsWeight} + ${table.salesPerformanceWeight} + ${table.teamPerformanceWeight} + ${table.customerExperienceWeight} + ${table.complianceAuditsWeight}) = 100`
    ),
  ]
);

export const aiDiagnosticSnapshots = pgTable(
  'ai_diagnostic_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchCode: text('branch_code')
      .notNull()
      .references(() => branches.code, { onDelete: 'restrict' }),
    isLiveAi: boolean('is_live_ai').notNull().default(false),
    modelUsed: text('model_used').notNull().default(''),
    analysisJson: jsonb('analysis_json').$type<Record<string, unknown>>().notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_ai_diagnostics_branch_generated').on(table.branchCode, table.generatedAt)]
);
