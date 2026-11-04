export type Language = 'en' | 'ar';
export type Theme = 'light' | 'dark';

export interface Branch {
  code: string;
  name: string;
  nameAr: string;
  city: string;
  cityAr: string;
  manager: string;
  managerAr: string;
  businessDate: string;
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
  role: string;
  roleAr: string;
  productKnowledgeScore: number;
  productivityScore: number;
  customerExperienceScore: number;
  coachingStatus: CoachingStatus;
  developmentAreas: string[];
  coachingNotes: string;
  agreedActions: string;
  assignedCoach: string;
  followUpDate: string;
  progressStatus: 'pending' | 'improving' | 'achieved';
  history: CoachingHistoryItem[];
}

export interface SalesBox {
  id: string;
  branchCode: string;
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
  issueCategory: string;
  issueCategoryAr: string;
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

export interface BranchHealthReportData {
  overallScore: number | null;
  categories: HealthCategoryScore[];
  weakestArea: string | null;
  weakestAreaAr: string | null;
  strongestArea: string | null;
  strongestAreaAr: string | null;
  trend: 'improving' | 'stable' | 'declining';
  calculationNote: string;
  calculationNoteAr: string;
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

export interface BranchDataStore {
  branch: Branch;
  tasks: Task[];
  employees: Employee[];
  salesBoxes: SalesBox[];
  cases: CustomerCase[];
  healthWeights: HealthWeights;
  cachedAiAnalysis?: AIAnalysisResult;
}
