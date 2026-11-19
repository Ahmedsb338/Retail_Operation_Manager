export type Language = 'en' | 'ar';
export type Theme = 'light' | 'dark';
export type AppRole = 'STORE_MANAGER' | 'AREA_MANAGER';

export type NavTab =
  | 'dashboard'
  | 'store-rpm'
  | 'agent-rpm'
  | 'store-kpis'
  | 'agent-kpis'
  | 'tnps-store'
  | 'tnps-agents'
  | 'complaints'
  | 'store-schedule'
  | 'schedule-exceptions'
  | 'operations'
  | 'hr-actions'
  | 'late-opening'
  | 'short-over'
  | 'action-plans'
  | 'target-calc'
  | 'tnps-calc'
  | 'team'
  | 'coaching'
  | 'sales'
  | 'health'
  | 'ai'
  | 'settings';

export interface AuthorizedBranchSummary {
  code: string;
  storeId: string;
  name: string;
  nameAr: string;
  city: string;
  cityAr: string;
  area: string;
  managerName: string;
  managerNameAr: string;
  businessDate: string;
  totalShifts: number;
  remainingShifts: number;
  targetDailyRevenue: number;
}

export interface UnconfiguredBranchItem {
  branchName: string;
  displayOrder: number;
  statusNote: string;
}

export interface AuthUser {
  sessionId: string;
  role: AppRole;
  username: string;
  displayName: string;
  branchCode: string | null;
  storeId: string | null;
  branchName: string | null;
  areaManagerId: string | null;
  mustRotatePassword: boolean;
  assignedAreas: string[];
  authorizedBranches: AuthorizedBranchSummary[];
}

export interface Branch {
  code: string;
  storeId: string;
  name: string;
  nameAr: string;
  city: string;
  cityAr: string;
  area?: string;
  manager: string;
  managerAr: string;
  businessDate: string;
  totalShifts?: number;
  remainingShifts?: number;
  targetDailyRevenue: number;
}

export type TaskCategory = 'financial' | 'contracts' | 'store' | 'customer';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';

export interface TaskHistoryItem {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details?: string;
}

export interface Task {
  id: string;
  branchCode: string;
  agentName?: string;
  date: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr?: string;
  category: TaskCategory;
  subcategory: string;
  owner: string;
  ownerRole?: string;
  createdAt: string;
  deadline: string;
  dueDate?: string;
  priority: TaskPriority;
  status: TaskStatus;
  notes: string;
  evidenceText?: string;
  completedAt?: string;
  updatedAt: string;
  history: TaskHistoryItem[];
}

export type CoachingStatus = 'needs_coaching' | 'scheduled' | 'in_progress' | 'on_track' | 'proficient';

export interface CoachingHistoryItem {
  id: string;
  date: string;
  coach: string;
  topic: string;
  agreedActions: string;
  scoreImprovement?: string;
  notes: string;
}

export interface Employee {
  id: string;
  branchCode: string;
  name: string;
  nameAr: string;
  identifier: string;
  sid?: string;
  role: string;
  roleTitle?: string;
  roleAr: string;
  roleTitleAr?: string;
  productKnowledgeScore: number | null;
  productivityScore: number | null;
  customerExperienceScore: number | null;
  coachingStatus: CoachingStatus;
  developmentAreas: string[];
  coachingNotes: string;
  agreedActions: string;
  assignedCoach: string;
  followUpDate: string;
  progressStatus: 'pending' | 'improving' | 'achieved';
  isActive?: boolean;
  history: CoachingHistoryItem[];
}

export interface SalesBox {
  id: string;
  branchCode: string;
  boxKey?: string;
  name: string;
  nameAr: string;
  target: number;
  actual: number;
  unit: string;
  unitAr: string;
  remainingWorkingDays: number;
  trend: 'up' | 'down' | 'stable';
  dailyHistory: Array<{ day: string; actual: number; target: number }>;
}

export type CaseStatus = 'pending' | 'under_review' | 'resolved' | 'escalated';

export interface CustomerCase {
  id: string;
  branchCode: string;
  caseNumber: string;
  customerIdentifier: string;
  agentName?: string;
  date?: string;
  issueCategory: string;
  issueCategoryAr: string;
  category?: string;
  categoryAr?: string;
  description: string;
  isRepeated: boolean;
  repeatedMatchCriteria: string;
  rootCause: string;
  rootCauseAr: string;
  assignedOwner: string;
  createdAt: string;
  updatedAt: string;
  resolutionDeadline: string;
  status: CaseStatus;
  correctiveAction: string;
  resolutionNotes: string;
  notes?: string;
}

export interface HealthWeights {
  dailyOperations: number;
  salesPerformance: number;
  teamPerformance: number;
  customerExperience: number;
  complianceAudits: number;
}

export interface HealthCategoryScore {
  key: keyof HealthWeights;
  name: string;
  nameAr: string;
  weight: number;
  score: number | null;
  status: 'optimal' | 'warning' | 'critical' | 'unavailable';
  details: string;
  detailsAr: string;
}

export interface AIActionPlanItem {
  id: string;
  issue: string;
  issueAr: string;
  evidence: string;
  evidenceAr: string;
  businessImpact: string;
  businessImpactAr: string;
  recommendedAction: string;
  recommendedActionAr: string;
  priority: 'Critical' | 'High' | 'Medium';
  suggestedOwner: string;
  suggestedDeadline: string;
  isCompleted?: boolean;
}

export interface AIAnalysisResult {
  generatedAt: string;
  isLiveAi: boolean;
  modelUsed?: string;
  branchOverview: {
    summary: string;
    summaryAr: string;
    operationalWeaknesses: string[];
    operationalWeaknessesAr: string[];
    immediatePriorities: string[];
    immediatePrioritiesAr: string[];
  };
  operationsIntelligence: {
    overdueTasksCount: number;
    auditStatus: string;
    auditStatusAr: string;
    criticalFindings: string[];
    criticalFindingsAr: string[];
  };
  teamInsights: {
    criticalGaps: string[];
    criticalGapsAr: string[];
    topPerformer: string;
    topPerformerAr: string;
    priorityCoachees: string[];
    priorityCoacheesAr: string[];
  };
  salesIntelligence: {
    weakestBox: string;
    weakestBoxAr: string;
    runRateAlert: string;
    runRateAlertAr: string;
    strategicActions: string[];
    strategicActionsAr: string[];
  };
  customerInsights: {
    agingSummary: string;
    agingSummaryAr: string;
    recurringRootCauses: string[];
    recurringRootCausesAr: string[];
  };
  actionPlan: AIActionPlanItem[];
}

export interface FiscalYearConfig {
  startDate: string;
  endDate: string;
  pillarTargets?: Array<{
    pillar: string;
    monthlyTarget: number | null;
    unit: string;
  }>;
}

export interface DashboardPillarMetric {
  pillar: string;
  achievement: number | null;
  passed: boolean;
  configured: boolean;
}

export interface DashboardTopAgent {
  agentName: string;
  sid: string;
  pillarCount: number;
  avgAchievement: number | null;
  passedCount: number;
}

export interface DashboardPayload {
  branchCount: number;
  agentCount: number;
  passedCount: number;
  pillarCount: number;
  overallAchievement: number | null;
  openComplaintsCount: number;
  weakestPillar: DashboardPillarMetric | null;
  pillars: DashboardPillarMetric[];
  agents: DashboardTopAgent[];
  operations: {
    total: number;
    completed: number;
    blocked: number;
    overdue: number;
    completionPercent: number | null;
  };
  tnps: {
    latestScore: number | null;
    benchmark: number;
    lastDate: string | null;
  };
  salesSummary: {
    boxCount: number;
    overallAchievement: number | null;
    boxes: Array<{
      id: string;
      branchCode: string;
      boxKey: string;
      name: string;
      nameAr: string;
      target: number;
      actual: number;
      remainingWorkingDays: number;
      achievement: number | null;
    }>;
  };
  fiscalYear: { startDate: string; endDate: string };
  authorizedBranches: AuthorizedBranchSummary[];
  canEdit: boolean;
}

export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  imported: number;
  rejected: number;
  reasons: Array<{ row: number; reason: string }>;
}

export interface DateRangeFilter {
  fromDate: string;
  toDate: string;
}

export interface StoreRpmRecord {
  id: string;
  branchCode: string;
  month: string;
  pillar: string;
  actual: number | null;
  target: number | null;
  achievementPercent: number | null;
  notes: string;
}

export interface AgentRpmRecord {
  id: string;
  branchCode: string;
  agentName: string;
  sid: string;
  month: string;
  pillar: string;
  actual: number | null;
  target: number | null;
  achievementPercent: number | null;
  notes: string;
}

export interface StoreKpiRecord {
  id: string;
  branchCode: string;
  month: string;
  kpiName: string;
  actual: number | null;
  target: number | null;
  achievementPercent: number | null;
  notes: string;
}

export interface AgentKpiRecord {
  id: string;
  branchCode: string;
  agentName: string;
  sid: string;
  month: string;
  kpiName: string;
  actual: number | null;
  target: number | null;
  achievementPercent: number | null;
  notes: string;
}

export interface TnpsStoreRecord {
  id: string;
  branchCode: string;
  recordType: 'monthly_log' | 'daily_calc';
  month: string;
  businessDate: string;
  agentName: string;
  detractors: number | null;
  passive: number | null;
  promoters: number | null;
  score: number | null;
  benchmark: number | null;
  achievementPercent: number | null;
  requiredPromoters: number | null;
  dailyRequired: number | null;
  agentRowsJson?: Array<Record<string, unknown>> | null;
  revisionNumber: number;
  updatedBy: string;
  notes: string;
}

export interface TnpsAgentRecord {
  id: string;
  branchCode: string;
  agentName: string;
  sid: string;
  month: string;
  score: number | null;
  benchmark: number | null;
  achievementPercent: number | null;
  notes: string;
}

export interface ScheduleExceptionRecord {
  id: string;
  branchCode: string;
  agentName: string;
  date: string;
  exceptionType: string;
  reason: string;
  approvedBy: string;
}

export interface HrActionRecord {
  id: string;
  branchCode: string;
  agentName: string;
  date: string;
  action: string;
  status: string;
  owner: string;
  notes: string;
}

export interface LateOpeningRecord {
  id: string;
  branchCode: string;
  agentName: string;
  date: string;
  plannedOpening: string;
  actualOpening: string;
  delayMinutes: number | null;
  reason: string;
  responsible: string;
}

export interface ShortOverRecord {
  id: string;
  branchCode: string;
  agentName: string;
  date: string;
  shortAmount: number | null;
  overAmount: number | null;
  netAmount: number | null;
  remarks: string;
}

export interface ActionPlanRecord {
  id: string;
  branchCode: string;
  agentName: string;
  pillars: string;
  reason: string;
  suggestedActions: string;
  owner: string;
  startDate: string;
  dueDate: string;
  status: 'open' | 'in_progress' | 'completed' | 'overdue' | 'blocked';
  beforeTracking: string;
  afterTracking: string;
}
