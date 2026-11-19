import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import {
  AIAnalysisResult,
  AuthUser,
  AuthorizedBranchSummary,
  Branch,
  CoachingHistoryItem,
  CustomerCase,
  DashboardPayload,
  DateRangeFilter,
  Employee,
  FiscalYearConfig,
  HealthCategoryScore,
  HealthWeights,
  Language,
  SalesBox,
  Task,
  TaskStatus,
  Theme,
  UnconfiguredBranchItem,
} from '../types';
import { translations, TranslationKey } from '../i18n/translations';
import {
  ApiError,
  apiRequest,
  buildQueryParams,
  onUnauthorizedResponse,
} from '../services/apiClient';

const DEFAULT_HEALTH_WEIGHTS: HealthWeights = {
  dailyOperations: 25,
  salesPerformance: 25,
  teamPerformance: 20,
  customerExperience: 15,
  complianceAudits: 15,
};

interface AppContextType {
  // Localization & Theme (UI preferences only)
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  t: (key: TranslationKey) => string;

  // Infrastructure Status
  authLoading: boolean;
  dataLoading: boolean;
  databaseUnavailable: boolean;
  databaseErrorMessage: string;
  missingDbVars: string[];
  geminiConfigured: boolean;
  refreshHealth: () => Promise<void>;

  // Authentication & Scope
  user: AuthUser | null;
  isAuthenticated: boolean;
  canEdit: boolean;
  configuredBranches: Array<{
    code: string;
    name: string;
    nameAr: string;
    city: string;
    cityAr: string;
    area: string;
  }>;
  unconfiguredBranches: UnconfiguredBranchItem[];
  authorizedBranches: AuthorizedBranchSummary[];
  selectedBranchCode: string;
  setSelectedBranchCode: (code: string) => void;
  currentBranch: Branch | null;
  dateRange: DateRangeFilter;
  setDateRange: (range: DateRangeFilter) => void;
  fiscalYear: FiscalYearConfig;
  refreshWorkspaceData: () => Promise<void>;
  reloadBranchesCatalog: () => Promise<void>;

  loginBranch: (params: {
    branchName: string;
    branchCode: string;
    accessCode: string;
  }) => Promise<{ success: boolean; message?: string; retryAfterSeconds?: number }>;
  loginArea: (params: {
    username: string;
    password: string;
  }) => Promise<{ success: boolean; message?: string; retryAfterSeconds?: number }>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;

  // Shared Domain Data
  dashboardData: DashboardPayload | null;
  tasks: Task[];
  employees: Employee[];
  salesBoxes: SalesBox[];
  cases: CustomerCase[];
  healthWeights: HealthWeights;
  aiAnalysis: AIAnalysisResult | null;
  isAiLoading: boolean;
  aiError: string | null;

  // Computed Metrics
  opsCompletionPercentage: number;
  totalTasksCount: number;
  completedTasksCount: number;
  pendingTasksCount: number;
  overdueTasksCount: number;
  blockedTasksCount: number;
  criticalAlerts: Array<{
    id: string;
    title: string;
    titleAr: string;
    type: 'task' | 'case' | 'sales';
    severity: 'critical' | 'high';
  }>;
  overallHealthScore: number;
  healthCategories: HealthCategoryScore[];
  weakestHealthArea: HealthCategoryScore | null;
  strongestHealthArea: HealthCategoryScore | null;
  salesOverallAchievement: number;
  employeesNeedingCoachingCount: number;
  pendingCasesCount: number;
  repeatedCasesCount: number;

  // Operations CRUD (Store Manager only)
  addTask: (
    task: Omit<Task, 'id' | 'branchCode' | 'createdAt' | 'updatedAt' | 'history'>
  ) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;

  // Staff & Coaching CRUD (Store Manager only)
  addEmployee: (emp: Omit<Employee, 'id' | 'branchCode' | 'history'>) => Promise<void>;
  updateEmployee: (emp: Employee) => Promise<void>;
  deleteEmployee: (empId: string) => Promise<void>;
  addCoachingSession: (
    employeeId: string,
    session: Omit<CoachingHistoryItem, 'id'>
  ) => Promise<void>;

  // Sales Boxes CRUD (Store Manager only)
  addSalesBox: (
    box: Omit<SalesBox, 'id' | 'branchCode' | 'dailyHistory'>
  ) => Promise<void>;
  updateSalesBox: (box: SalesBox) => Promise<void>;
  deleteSalesBox: (boxId: string) => Promise<void>;

  // Complaints CRUD (Store Manager only)
  addCase: (
    caseItem: Omit<CustomerCase, 'id' | 'branchCode' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  updateCase: (caseItem: CustomerCase) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;

  // Health Weights
  updateHealthWeights: (weights: HealthWeights) => Promise<void>;
  resetHealthWeights: () => Promise<void>;

  // Settings
  saveFiscalYear: (payload: FiscalYearConfig) => Promise<void>;
  updateBranchProfile: (payload: {
    managerName?: string;
    managerNameAr?: string;
    businessDate?: string;
    targetDailyRevenue?: number;
  }) => Promise<void>;

  // AI Analytics
  runAiDiagnostic: () => Promise<void>;
  toggleActionPlanItem: (itemId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const UI_PREF_KEYS = {
  LANG: 'asb_ui_language',
  THEME: 'asb_ui_theme',
};

function toFrontendTask(raw: any): Task {
  return {
    id: String(raw.id),
    branchCode: String(raw.branchCode || ''),
    agentName: String(raw.agentName || ''),
    date: String(raw.date || ''),
    title: String(raw.title || ''),
    titleAr: String(raw.titleAr || raw.title || ''),
    description: String(raw.description || ''),
    descriptionAr: String(raw.descriptionAr || ''),
    category: (raw.category || 'store') as Task['category'],
    subcategory: String(raw.subcategory || ''),
    owner: String(raw.owner || ''),
    ownerRole: String(raw.ownerRole || ''),
    createdAt: String(raw.createdAt || raw.date || new Date().toISOString()),
    deadline: String(raw.dueDate || raw.date || ''),
    dueDate: String(raw.dueDate || ''),
    priority: (raw.priority || 'medium') as Task['priority'],
    status: (raw.status || 'not_started') as Task['status'],
    notes: String(raw.notes || ''),
    evidenceText: String(raw.evidenceText || ''),
    completedAt: raw.completedAt ? String(raw.completedAt) : undefined,
    updatedAt: String(raw.updatedAt || raw.createdAt || new Date().toISOString()),
    history: Array.isArray(raw.historyJson) ? raw.historyJson : [],
  };
}

function toFrontendEmployee(raw: any): Employee {
  return {
    id: String(raw.id),
    branchCode: String(raw.branchCode || ''),
    name: String(raw.name || ''),
    nameAr: String(raw.nameAr || raw.name || ''),
    identifier: String(raw.sid || ''),
    sid: String(raw.sid || ''),
    role: String(raw.roleTitle || ''),
    roleTitle: String(raw.roleTitle || ''),
    roleAr: String(raw.roleTitleAr || raw.roleTitle || ''),
    roleTitleAr: String(raw.roleTitleAr || ''),
    productKnowledgeScore:
      raw.productKnowledgeScore === null || raw.productKnowledgeScore === undefined
        ? null
        : Number(raw.productKnowledgeScore),
    productivityScore:
      raw.productivityScore === null || raw.productivityScore === undefined
        ? null
        : Number(raw.productivityScore),
    customerExperienceScore:
      raw.customerExperienceScore === null || raw.customerExperienceScore === undefined
        ? null
        : Number(raw.customerExperienceScore),
    coachingStatus: (raw.coachingStatus || 'needs_coaching') as Employee['coachingStatus'],
    developmentAreas: Array.isArray(raw.developmentAreas) ? raw.developmentAreas : [],
    coachingNotes: String(raw.coachingNotes || ''),
    agreedActions: String(raw.agreedActions || ''),
    assignedCoach: String(raw.assignedCoach || ''),
    followUpDate: String(raw.followUpDate || ''),
    progressStatus: (raw.progressStatus || 'pending') as Employee['progressStatus'],
    isActive: raw.isActive !== false,
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

function toFrontendCase(raw: any): CustomerCase {
  return {
    id: String(raw.id),
    branchCode: String(raw.branchCode || ''),
    caseNumber: String(raw.caseNumber || ''),
    customerIdentifier: String(raw.customerIdentifier || ''),
    agentName: String(raw.agentName || ''),
    date: String(raw.date || ''),
    issueCategory: String(raw.category || ''),
    issueCategoryAr: String(raw.categoryAr || raw.category || ''),
    category: String(raw.category || ''),
    categoryAr: String(raw.categoryAr || ''),
    description: String(raw.description || ''),
    isRepeated: Boolean(raw.isRepeated),
    repeatedMatchCriteria: String(raw.repeatedMatchCriteria || ''),
    rootCause: String(raw.rootCause || ''),
    rootCauseAr: String(raw.rootCauseAr || raw.rootCause || ''),
    assignedOwner: String(raw.assignedOwner || ''),
    createdAt: String(raw.createdAt || raw.date || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || raw.createdAt || new Date().toISOString()),
    resolutionDeadline: String(raw.resolutionDeadline || ''),
    status: (raw.status || 'pending') as CustomerCase['status'],
    correctiveAction: String(raw.correctiveAction || ''),
    resolutionNotes: String(raw.notes || ''),
    notes: String(raw.notes || ''),
  };
}

function toFrontendSalesBox(raw: any): SalesBox {
  return {
    id: String(raw.id),
    branchCode: String(raw.branchCode || ''),
    boxKey: String(raw.boxKey || ''),
    name: String(raw.name || ''),
    nameAr: String(raw.nameAr || raw.name || ''),
    target: Number(raw.target || 0),
    actual: Number(raw.actual || 0),
    unit: String(raw.unit || ''),
    unitAr: String(raw.unitAr || raw.unit || ''),
    remainingWorkingDays: Number(raw.remainingWorkingDays || 0),
    trend: (raw.trend || 'stable') as SalesBox['trend'],
    dailyHistory: Array.isArray(raw.dailyHistoryJson) ? raw.dailyHistoryJson : [],
  };
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. UI Language & Theme
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(UI_PREF_KEYS.LANG);
      return saved === 'ar' || saved === 'en' ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(UI_PREF_KEYS.LANG, lang);
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(UI_PREF_KEYS.THEME);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem(UI_PREF_KEYS.THEME, nextTheme);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[language][key] || translations.en[key] || String(key);
    },
    [language]
  );

  // 2. Backend availability & auth session
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [databaseUnavailable, setDatabaseUnavailable] = useState<boolean>(false);
  const [databaseErrorMessage, setDatabaseErrorMessage] = useState<string>('');
  const [missingDbVars, setMissingDbVars] = useState<string[]>([]);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean>(false);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [configuredBranches, setConfiguredBranches] = useState<
    Array<{
      code: string;
      name: string;
      nameAr: string;
      city: string;
      cityAr: string;
      area: string;
    }>
  >([]);
  const [unconfiguredBranches, setUnconfiguredBranches] = useState<UnconfiguredBranchItem[]>([]);
  const [selectedBranchCode, setSelectedBranchCodeState] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRangeFilter>({ fromDate: '', toDate: '' });
  const [fiscalYear, setFiscalYear] = useState<FiscalYearConfig>({
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    pillarTargets: [],
  });

  // 3. Domain stores loaded from PostgreSQL API
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salesBoxes, setSalesBoxes] = useState<SalesBox[]>([]);
  const [cases, setCases] = useState<CustomerCase[]>([]);
  const [healthWeights, setHealthWeights] = useState<HealthWeights>(DEFAULT_HEALTH_WEIGHTS);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleDbError = useCallback((err: unknown): boolean => {
    if (err instanceof ApiError && (err.status === 503 || err.code === 'DATABASE_UNAVAILABLE')) {
      setDatabaseUnavailable(true);
      setDatabaseErrorMessage(err.message);
      if (err.missingVariables) setMissingDbVars(err.missingVariables);
      return true;
    }
    return false;
  }, []);

  const reloadBranchesCatalog = useCallback(async () => {
    try {
      const data = await apiRequest<{
        configuredBranches: typeof configuredBranches;
        unconfiguredBranches: UnconfiguredBranchItem[];
      }>('/api/v1/auth/branches', { skipAuthRedirect: true });
      setConfiguredBranches(data.configuredBranches || []);
      setUnconfiguredBranches(data.unconfiguredBranches || []);
      setDatabaseUnavailable(false);
    } catch (err) {
      handleDbError(err);
    }
  }, [handleDbError]);

  const refreshHealth = useCallback(async () => {
    try {
      const health = await apiRequest<{
        databaseConfigured: boolean;
        geminiConfigured: boolean;
      }>('/api/v1/health', { skipAuthRedirect: true });
      setGeminiConfigured(Boolean(health.geminiConfigured));
      if (!health.databaseConfigured) {
        setDatabaseUnavailable(true);
      } else {
        setDatabaseUnavailable(false);
        setDatabaseErrorMessage('');
        setMissingDbVars([]);
      }
    } catch {
      // ignore
    }
  }, []);

  // Register 401 listener so expired/revoked cookies immediately transition cleanly to AccessPage
  useEffect(() => {
    onUnauthorizedResponse(() => {
      setUser(null);
      setDashboardData(null);
      setTasks([]);
      setEmployees([]);
      setSalesBoxes([]);
      setCases([]);
    });
    return () => onUnauthorizedResponse(null);
  }, []);

  // Initial session hydration
  useEffect(() => {
    let active = true;
    async function bootstrap() {
      setAuthLoading(true);
      try {
        const health = await apiRequest<{
          databaseConfigured: boolean;
          geminiConfigured: boolean;
        }>('/api/v1/health', { skipAuthRedirect: true });
        if (!active) return;
        setGeminiConfigured(Boolean(health.geminiConfigured));
        if (!health.databaseConfigured) {
          setDatabaseUnavailable(true);
          setAuthLoading(false);
          return;
        }
        await reloadBranchesCatalog();
        try {
          const me = await apiRequest<{ user: AuthUser }>('/api/v1/auth/me', {
            skipAuthRedirect: true,
          });
          if (!active) return;
          setUser(me.user);
          if (me.user.role === 'STORE_MANAGER' && me.user.branchCode) {
            setSelectedBranchCodeState(me.user.branchCode);
          } else {
            setSelectedBranchCodeState('');
          }
        } catch {
          if (active) setUser(null);
        }
      } catch (err) {
        handleDbError(err);
      } finally {
        if (active) setAuthLoading(false);
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, [handleDbError, reloadBranchesCatalog]);

  const isAuthenticated = Boolean(user);
  const canEdit = user?.role === 'STORE_MANAGER';
  const authorizedBranches = user?.authorizedBranches || [];

  const setSelectedBranchCode = useCallback(
    (code: string) => {
      if (!user) return;
      if (user.role === 'STORE_MANAGER') {
        setSelectedBranchCodeState(user.branchCode || '');
        return;
      }
      setSelectedBranchCodeState(code);
    },
    [user]
  );

  // Active branch for display / single-branch views (Target Calc, TNPS Calc, AI, Health)
  const currentBranch: Branch | null = useMemo(() => {
    if (!user) return null;
    const targetCode =
      user.role === 'STORE_MANAGER'
        ? user.branchCode
        : selectedBranchCode || user.authorizedBranches[0]?.code || null;
    if (!targetCode) return null;
    const found = user.authorizedBranches.find((b) => b.code === targetCode);
    if (!found) return null;
    return {
      code: found.code,
      storeId: found.storeId,
      name: found.name,
      nameAr: found.nameAr || found.name,
      city: found.city,
      cityAr: found.cityAr || found.city,
      area: found.area,
      manager: found.managerName || 'Store Manager',
      managerAr: found.managerNameAr || found.managerName || 'مدير الفرع',
      businessDate: found.businessDate || new Date().toISOString().slice(0, 10),
      totalShifts: found.totalShifts,
      remainingShifts: found.remainingShifts,
      targetDailyRevenue: found.targetDailyRevenue,
    };
  }, [user, selectedBranchCode]);

  const scopeQuery = useMemo(() => {
    const branchParam =
      user?.role === 'AREA_MANAGER' ? selectedBranchCode || undefined : user?.branchCode || undefined;
    return buildQueryParams({
      branchCode: branchParam,
      fromDate: dateRange.fromDate || undefined,
      toDate: dateRange.toDate || undefined,
    });
  }, [user, selectedBranchCode, dateRange]);

  const singleBranchQuery = useMemo(() => {
    const targetCode =
      user?.role === 'STORE_MANAGER'
        ? user.branchCode
        : selectedBranchCode || user?.authorizedBranches[0]?.code || undefined;
    return buildQueryParams({ branchCode: targetCode });
  }, [user, selectedBranchCode]);

  const refreshWorkspaceData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const [
        dashRes,
        tasksRes,
        staffRes,
        salesRes,
        casesRes,
        weightsRes,
        fyRes,
        aiRes,
      ] = await Promise.all([
        apiRequest<DashboardPayload>(`/api/v1/dashboard${scopeQuery}`),
        apiRequest<{ records: any[] }>(`/api/v1/store-tasks${scopeQuery}`),
        apiRequest<{ staff: any[] }>(
          `/api/v1/staff${buildQueryParams({
            branchCode:
              user.role === 'AREA_MANAGER'
                ? selectedBranchCode || undefined
                : user.branchCode || undefined,
          })}`
        ),
        apiRequest<{ records: any[] }>(
          `/api/v1/sales-boxes${buildQueryParams({
            branchCode:
              user.role === 'AREA_MANAGER'
                ? selectedBranchCode || undefined
                : user.branchCode || undefined,
          })}`
        ),
        apiRequest<{ records: any[] }>(`/api/v1/complaints${scopeQuery}`),
        apiRequest<{ weights: HealthWeights }>(`/api/v1/branch-health/weights${singleBranchQuery}`),
        apiRequest<FiscalYearConfig>('/api/v1/settings/fiscal-year'),
        apiRequest<{ snapshot: { analysisJson: AIAnalysisResult } | null }>(
          `/api/v1/ai/diagnostics${singleBranchQuery}`
        ),
      ]);

      setDashboardData(dashRes);
      setTasks((tasksRes.records || []).map(toFrontendTask));
      setEmployees((staffRes.staff || []).map(toFrontendEmployee));
      setSalesBoxes((salesRes.records || []).map(toFrontendSalesBox));
      setCases((casesRes.records || []).map(toFrontendCase));
      setHealthWeights(weightsRes.weights || DEFAULT_HEALTH_WEIGHTS);
      setFiscalYear(fyRes);
      setAiAnalysis(aiRes.snapshot?.analysisJson || null);
      setDatabaseUnavailable(false);
    } catch (err) {
      handleDbError(err);
    } finally {
      setDataLoading(false);
    }
  }, [user, scopeQuery, singleBranchQuery, selectedBranchCode, handleDbError]);

  useEffect(() => {
    if (user) {
      refreshWorkspaceData();
    }
  }, [user, refreshWorkspaceData]);

  // Auth actions
  const loginBranch = async (params: {
    branchName: string;
    branchCode: string;
    accessCode: string;
  }) => {
    try {
      const res = await apiRequest<{ user: AuthUser }>('/api/v1/auth/login-branch', {
        method: 'POST',
        body: params,
        skipAuthRedirect: true,
      });
      setUser(res.user);
      setSelectedBranchCodeState(res.user.branchCode || '');
      return { success: true };
    } catch (err) {
      if (handleDbError(err)) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Database unavailable.',
        };
      }
      if (err instanceof ApiError) {
        return {
          success: false,
          message: err.message,
          retryAfterSeconds: err.retryAfterSeconds,
        };
      }
      return { success: false, message: 'Sign-in failed.' };
    }
  };

  const loginArea = async (params: { username: string; password: string }) => {
    try {
      const res = await apiRequest<{ user: AuthUser }>('/api/v1/auth/login-area', {
        method: 'POST',
        body: params,
        skipAuthRedirect: true,
      });
      setUser(res.user);
      setSelectedBranchCodeState('');
      return { success: true };
    } catch (err) {
      if (handleDbError(err)) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Database unavailable.',
        };
      }
      if (err instanceof ApiError) {
        return {
          success: false,
          message: err.message,
          retryAfterSeconds: err.retryAfterSeconds,
        };
      }
      return { success: false, message: 'Sign-in failed.' };
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/api/v1/auth/logout', { method: 'POST', skipAuthRedirect: true });
    } catch {
      // clear UI session regardless
    }
    setUser(null);
    setDashboardData(null);
    setTasks([]);
    setEmployees([]);
    setSalesBoxes([]);
    setCases([]);
    setAiAnalysis(null);
  };

  const logoutAll = async () => {
    try {
      await apiRequest('/api/v1/auth/logout-all', { method: 'POST', skipAuthRedirect: true });
    } catch {
      // ignore
    }
    setUser(null);
    setDashboardData(null);
    setTasks([]);
    setEmployees([]);
    setSalesBoxes([]);
    setCases([]);
    setAiAnalysis(null);
  };

  // Computed metrics derived from database records
  const now = new Date();
  const isTaskOverdue = (deadlineStr: string, status: TaskStatus) => {
    if (status === 'completed' || !deadlineStr) return false;
    try {
      return new Date(deadlineStr) < now;
    } catch {
      return false;
    }
  };

  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter((t) => t.status === 'completed').length;
  const overdueTasksCount = tasks.filter((t) => isTaskOverdue(t.deadline, t.status)).length;
  const blockedTasksCount = tasks.filter((t) => t.status === 'blocked').length;
  const pendingTasksCount = tasks.filter(
    (t) => t.status === 'in_progress' || t.status === 'not_started'
  ).length;
  const opsCompletionPercentage =
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const criticalAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      title: string;
      titleAr: string;
      type: 'task' | 'case' | 'sales';
      severity: 'critical' | 'high';
    }> = [];

    tasks.forEach((t) => {
      if (t.status === 'blocked') {
        alerts.push({
          id: `alert-task-${t.id}`,
          title: `Blocked Task: ${t.title}`,
          titleAr: `مهمة معطلة: ${t.titleAr || t.title}`,
          type: 'task',
          severity: 'critical',
        });
      } else if (
        isTaskOverdue(t.deadline, t.status) &&
        (t.priority === 'critical' || t.priority === 'high')
      ) {
        alerts.push({
          id: `alert-task-overdue-${t.id}`,
          title: `Overdue Task: ${t.title}`,
          titleAr: `مهمة متأخرة: ${t.titleAr || t.title}`,
          type: 'task',
          severity: 'high',
        });
      }
    });

    cases.forEach((c) => {
      if (c.status === 'escalated') {
        alerts.push({
          id: `alert-case-${c.id}`,
          title: `Escalated Complaint #${c.caseNumber} (${c.issueCategory})`,
          titleAr: `شكوى مصعدة #${c.caseNumber} (${c.issueCategoryAr || c.issueCategory})`,
          type: 'case',
          severity: 'critical',
        });
      }
    });

    salesBoxes.forEach((b) => {
      const ach = b.target > 0 ? (b.actual / b.target) * 100 : 100;
      if (ach < 60 && b.remainingWorkingDays <= 10) {
        alerts.push({
          id: `alert-sales-${b.id}`,
          title: `Sales Deficit: ${b.name} (${Math.round(ach)}% achieved)`,
          titleAr: `عجز مبيعات: ${b.nameAr || b.name} (${Math.round(ach)}% محقق)`,
          type: 'sales',
          severity: 'high',
        });
      }
    });

    return alerts;
  }, [tasks, cases, salesBoxes]);

  const salesOverallAchievement = useMemo(() => {
    const valid = salesBoxes.filter((b) => b.target > 0);
    if (valid.length === 0) return 0;
    const avg =
      valid.reduce((sum, b) => sum + Math.min(100, (b.actual / b.target) * 100), 0) /
      valid.length;
    return Math.round(avg);
  }, [salesBoxes]);

  const employeesNeedingCoachingCount = useMemo(() => {
    return employees.filter(
      (e) =>
        e.coachingStatus === 'needs_coaching' ||
        (e.productKnowledgeScore !== null && e.productKnowledgeScore < 75) ||
        (e.productivityScore !== null && e.productivityScore < 75) ||
        (e.customerExperienceScore !== null && e.customerExperienceScore < 75)
    ).length;
  }, [employees]);

  const pendingCasesCount = cases.filter(
    (c) => c.status === 'pending' || c.status === 'under_review'
  ).length;
  const repeatedCasesCount = cases.filter((c) => c.isRepeated).length;

  const healthCategories: HealthCategoryScore[] = useMemo(() => {
    const opsScore =
      totalTasksCount > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(opsCompletionPercentage - overdueTasksCount * 8 - blockedTasksCount * 12)
            )
          )
        : null;

    const validBoxes = salesBoxes.filter((b) => b.target > 0);
    const salesScore = validBoxes.length > 0 ? Math.min(100, salesOverallAchievement) : null;

    const scoredStaff = employees.filter(
      (e) =>
        e.productKnowledgeScore !== null &&
        e.productivityScore !== null &&
        e.customerExperienceScore !== null
    );
    let teamScore: number | null = null;
    if (scoredStaff.length > 0) {
      const avgK =
        scoredStaff.reduce((s, e) => s + (e.productKnowledgeScore ?? 0), 0) / scoredStaff.length;
      const avgP =
        scoredStaff.reduce((s, e) => s + (e.productivityScore ?? 0), 0) / scoredStaff.length;
      const avgC =
        scoredStaff.reduce((s, e) => s + (e.customerExperienceScore ?? 0), 0) /
        scoredStaff.length;
      teamScore = Math.round((avgK + avgP + avgC) / 3);
    }

    let cxScore: number | null = null;
    if (cases.length > 0) {
      const resolvedRatio = cases.filter((c) => c.status === 'resolved').length / cases.length;
      const escalatedCount = cases.filter((c) => c.status === 'escalated').length;
      cxScore = Math.max(
        0,
        Math.min(100, Math.round(resolvedRatio * 100 - escalatedCount * 10 - repeatedCasesCount * 5))
      );
    }

    const auditTasks = tasks.filter(
      (t) => t.category === 'financial' || t.category === 'contracts'
    );
    let complianceScore: number | null = null;
    if (auditTasks.length > 0) {
      complianceScore = Math.round(
        (auditTasks.filter((t) => t.status === 'completed').length / auditTasks.length) * 100
      );
    }

    const getStatus = (
      score: number | null
    ): 'optimal' | 'warning' | 'critical' | 'unavailable' => {
      if (score === null) return 'unavailable';
      if (score >= 80) return 'optimal';
      if (score >= 60) return 'warning';
      return 'critical';
    };

    return [
      {
        key: 'dailyOperations',
        name: 'Daily Operations',
        nameAr: 'العمليات اليومية',
        weight: healthWeights.dailyOperations,
        score: opsScore,
        status: getStatus(opsScore),
        details: `${completedTasksCount}/${totalTasksCount} tasks completed, ${overdueTasksCount} overdue, ${blockedTasksCount} blocked`,
        detailsAr: `${completedTasksCount} من ${totalTasksCount} مهام مكتملة، ${overdueTasksCount} متأخرة، ${blockedTasksCount} معطلة`,
      },
      {
        key: 'salesPerformance',
        name: 'Sales Performance',
        nameAr: 'الأداء البيعي',
        weight: healthWeights.salesPerformance,
        score: salesScore,
        status: getStatus(salesScore),
        details:
          salesScore === null
            ? 'No configured sales boxes yet'
            : `${salesOverallAchievement}% across ${validBoxes.length} boxes`,
        detailsAr:
          salesScore === null
            ? 'لا توجد صناديق مبيعات مُعدة بعد'
            : `${salesOverallAchievement}% عبر ${validBoxes.length} صناديق`,
      },
      {
        key: 'teamPerformance',
        name: 'Team & Coaching',
        nameAr: 'أداء الفريق والتطوير',
        weight: healthWeights.teamPerformance,
        score: teamScore,
        status: getStatus(teamScore),
        details: `${employees.length} team members recorded, ${employeesNeedingCoachingCount} needing coaching`,
        detailsAr: `${employees.length} موظفين مسجلين، ${employeesNeedingCoachingCount} يحتاجون توجيهاً`,
      },
      {
        key: 'customerExperience',
        name: 'Complaints & CX',
        nameAr: 'الشكاوى وتجربة العملاء',
        weight: healthWeights.customerExperience,
        score: cxScore,
        status: getStatus(cxScore),
        details: `${pendingCasesCount} open complaints, ${repeatedCasesCount} repeated issues`,
        detailsAr: `${pendingCasesCount} شكاوى مفتوحة، ${repeatedCasesCount} متكررة`,
      },
      {
        key: 'complianceAudits',
        name: 'Compliance & Audits',
        nameAr: 'الامتثال والتدقيق',
        weight: healthWeights.complianceAudits,
        score: complianceScore,
        status: getStatus(complianceScore),
        details:
          complianceScore === null
            ? 'No financial/contract tasks logged'
            : `${auditTasks.filter((t) => t.status === 'completed').length}/${auditTasks.length} audits verified`,
        detailsAr:
          complianceScore === null
            ? 'لا توجد مهام تدقيق مسجلة'
            : `${auditTasks.filter((t) => t.status === 'completed').length} من ${auditTasks.length} تدقيقات مكتملة`,
      },
    ];
  }, [
    totalTasksCount,
    completedTasksCount,
    overdueTasksCount,
    blockedTasksCount,
    opsCompletionPercentage,
    salesBoxes,
    salesOverallAchievement,
    employees,
    employeesNeedingCoachingCount,
    cases,
    pendingCasesCount,
    repeatedCasesCount,
    tasks,
    healthWeights,
  ]);

  const overallHealthScore = useMemo(() => {
    let totalWeightUsed = 0;
    let weightedSum = 0;
    healthCategories.forEach((cat) => {
      if (cat.score !== null) {
        weightedSum += (cat.score * cat.weight) / 100;
        totalWeightUsed += cat.weight;
      }
    });
    if (totalWeightUsed === 0) return 0;
    return Math.round((weightedSum / totalWeightUsed) * 100);
  }, [healthCategories]);

  const weakestHealthArea = useMemo(() => {
    const valid = healthCategories.filter((c) => c.score !== null);
    if (valid.length === 0) return null;
    return valid.reduce(
      (min, curr) => ((curr.score ?? 100) < (min.score ?? 100) ? curr : min),
      valid[0]
    );
  }, [healthCategories]);

  const strongestHealthArea = useMemo(() => {
    const valid = healthCategories.filter((c) => c.score !== null);
    if (valid.length === 0) return null;
    return valid.reduce(
      (max, curr) => ((curr.score ?? 0) > (max.score ?? 0) ? curr : max),
      valid[0]
    );
  }, [healthCategories]);

  // Operations CRUD
  const addTask = async (
    taskInput: Omit<Task, 'id' | 'branchCode' | 'createdAt' | 'updatedAt' | 'history'>
  ) => {
    await apiRequest('/api/v1/store-tasks', {
      method: 'POST',
      body: {
        agentName: taskInput.agentName || taskInput.owner || '',
        date: taskInput.date || taskInput.deadline || new Date().toISOString().slice(0, 10),
        title: taskInput.title,
        titleAr: taskInput.titleAr || '',
        description: taskInput.description || '',
        descriptionAr: taskInput.descriptionAr || '',
        category: taskInput.category,
        subcategory: taskInput.subcategory || '',
        owner: taskInput.owner || '',
        ownerRole: taskInput.ownerRole || '',
        priority: taskInput.priority,
        status: taskInput.status,
        dueDate: taskInput.deadline || taskInput.dueDate || '',
        notes: taskInput.notes || '',
        evidenceText: taskInput.evidenceText || '',
      },
    });
    await refreshWorkspaceData();
  };

  const updateTask = async (taskInput: Task) => {
    await apiRequest(`/api/v1/store-tasks/${taskInput.id}`, {
      method: 'PATCH',
      body: {
        agentName: taskInput.agentName || taskInput.owner || '',
        date: taskInput.date || taskInput.deadline || new Date().toISOString().slice(0, 10),
        title: taskInput.title,
        titleAr: taskInput.titleAr || '',
        description: taskInput.description || '',
        descriptionAr: taskInput.descriptionAr || '',
        category: taskInput.category,
        subcategory: taskInput.subcategory || '',
        owner: taskInput.owner || '',
        ownerRole: taskInput.ownerRole || '',
        priority: taskInput.priority,
        status: taskInput.status,
        dueDate: taskInput.deadline || taskInput.dueDate || '',
        notes: taskInput.notes || '',
        evidenceText: taskInput.evidenceText || '',
      },
    });
    await refreshWorkspaceData();
  };

  const deleteTask = async (taskId: string) => {
    await apiRequest(`/api/v1/store-tasks/${taskId}`, { method: 'DELETE' });
    await refreshWorkspaceData();
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    await apiRequest(`/api/v1/store-tasks/${taskId}`, {
      method: 'PATCH',
      body: { status },
    });
    await refreshWorkspaceData();
  };

  // Staff & Coaching CRUD
  const addEmployee = async (emp: Omit<Employee, 'id' | 'branchCode' | 'history'>) => {
    await apiRequest('/api/v1/staff', {
      method: 'POST',
      body: {
        sid: emp.identifier || emp.sid || '',
        name: emp.name,
        nameAr: emp.nameAr || '',
        roleTitle: emp.role || emp.roleTitle || '',
        roleTitleAr: emp.roleAr || emp.roleTitleAr || '',
        productKnowledgeScore: emp.productKnowledgeScore,
        productivityScore: emp.productivityScore,
        customerExperienceScore: emp.customerExperienceScore,
        coachingStatus: emp.coachingStatus,
        developmentAreas: emp.developmentAreas || [],
        coachingNotes: emp.coachingNotes || '',
        agreedActions: emp.agreedActions || '',
        assignedCoach: emp.assignedCoach || '',
        followUpDate: emp.followUpDate || '',
        progressStatus: emp.progressStatus || 'pending',
        isActive: emp.isActive !== false,
      },
    });
    await refreshWorkspaceData();
  };

  const updateEmployee = async (emp: Employee) => {
    await apiRequest(`/api/v1/staff/${emp.id}`, {
      method: 'PATCH',
      body: {
        sid: emp.identifier || emp.sid || '',
        name: emp.name,
        nameAr: emp.nameAr || '',
        roleTitle: emp.role || emp.roleTitle || '',
        roleTitleAr: emp.roleAr || emp.roleTitleAr || '',
        productKnowledgeScore: emp.productKnowledgeScore,
        productivityScore: emp.productivityScore,
        customerExperienceScore: emp.customerExperienceScore,
        coachingStatus: emp.coachingStatus,
        developmentAreas: emp.developmentAreas || [],
        coachingNotes: emp.coachingNotes || '',
        agreedActions: emp.agreedActions || '',
        assignedCoach: emp.assignedCoach || '',
        followUpDate: emp.followUpDate || '',
        progressStatus: emp.progressStatus || 'pending',
        isActive: emp.isActive !== false,
      },
    });
    await refreshWorkspaceData();
  };

  const deleteEmployee = async (empId: string) => {
    await apiRequest(`/api/v1/staff/${empId}`, { method: 'DELETE' });
    await refreshWorkspaceData();
  };

  const addCoachingSession = async (
    employeeId: string,
    session: Omit<CoachingHistoryItem, 'id'>
  ) => {
    await apiRequest(`/api/v1/staff/${employeeId}/coaching-sessions`, {
      method: 'POST',
      body: {
        sessionDate: session.date,
        coach: session.coach,
        topic: session.topic,
        agreedActions: session.agreedActions || '',
        scoreImprovement: session.scoreImprovement || '',
        notes: session.notes || '',
      },
    });
    await refreshWorkspaceData();
  };

  // Sales Boxes CRUD
  const addSalesBox = async (box: Omit<SalesBox, 'id' | 'branchCode' | 'dailyHistory'>) => {
    await apiRequest('/api/v1/sales-boxes', {
      method: 'POST',
      body: {
        boxKey: box.boxKey || undefined,
        name: box.name,
        nameAr: box.nameAr || '',
        target: Number(box.target) || 0,
        actual: Number(box.actual) || 0,
        unit: box.unit || '',
        unitAr: box.unitAr || '',
        remainingWorkingDays: Number(box.remainingWorkingDays) || 0,
        trend: box.trend || 'stable',
      },
    });
    await refreshWorkspaceData();
  };

  const updateSalesBox = async (box: SalesBox) => {
    await apiRequest(`/api/v1/sales-boxes/${box.id}`, {
      method: 'PATCH',
      body: {
        name: box.name,
        nameAr: box.nameAr || '',
        target: Number(box.target) || 0,
        actual: Number(box.actual) || 0,
        unit: box.unit || '',
        unitAr: box.unitAr || '',
        remainingWorkingDays: Number(box.remainingWorkingDays) || 0,
        trend: box.trend || 'stable',
      },
    });
    await refreshWorkspaceData();
  };

  const deleteSalesBox = async (boxId: string) => {
    await apiRequest(`/api/v1/sales-boxes/${boxId}`, { method: 'DELETE' });
    await refreshWorkspaceData();
  };

  // Complaints CRUD
  const addCase = async (
    caseItem: Omit<CustomerCase, 'id' | 'branchCode' | 'createdAt' | 'updatedAt'>
  ) => {
    await apiRequest('/api/v1/complaints', {
      method: 'POST',
      body: {
        caseNumber: caseItem.caseNumber,
        customerIdentifier: caseItem.customerIdentifier || '',
        agentName: caseItem.agentName || '',
        date: caseItem.date || new Date().toISOString().slice(0, 10),
        category: caseItem.issueCategory || caseItem.category || 'General',
        categoryAr: caseItem.issueCategoryAr || caseItem.categoryAr || '',
        description: caseItem.description || '',
        isRepeated: Boolean(caseItem.isRepeated),
        repeatedMatchCriteria: caseItem.repeatedMatchCriteria || '',
        rootCause: caseItem.rootCause || '',
        rootCauseAr: caseItem.rootCauseAr || '',
        assignedOwner: caseItem.assignedOwner || '',
        resolutionDeadline: caseItem.resolutionDeadline || '',
        status: caseItem.status || 'pending',
        correctiveAction: caseItem.correctiveAction || '',
        notes: caseItem.resolutionNotes || caseItem.notes || '',
      },
    });
    await refreshWorkspaceData();
  };

  const updateCase = async (caseItem: CustomerCase) => {
    await apiRequest(`/api/v1/complaints/${caseItem.id}`, {
      method: 'PATCH',
      body: {
        caseNumber: caseItem.caseNumber,
        customerIdentifier: caseItem.customerIdentifier || '',
        agentName: caseItem.agentName || '',
        date: caseItem.date || caseItem.createdAt.slice(0, 10),
        category: caseItem.issueCategory || caseItem.category || 'General',
        categoryAr: caseItem.issueCategoryAr || caseItem.categoryAr || '',
        description: caseItem.description || '',
        isRepeated: Boolean(caseItem.isRepeated),
        repeatedMatchCriteria: caseItem.repeatedMatchCriteria || '',
        rootCause: caseItem.rootCause || '',
        rootCauseAr: caseItem.rootCauseAr || '',
        assignedOwner: caseItem.assignedOwner || '',
        resolutionDeadline: caseItem.resolutionDeadline || '',
        status: caseItem.status,
        correctiveAction: caseItem.correctiveAction || '',
        notes: caseItem.resolutionNotes || caseItem.notes || '',
      },
    });
    await refreshWorkspaceData();
  };

  const deleteCase = async (caseId: string) => {
    await apiRequest(`/api/v1/complaints/${caseId}`, { method: 'DELETE' });
    await refreshWorkspaceData();
  };

  // Health Weights & Settings
  const updateHealthWeights = async (weights: HealthWeights) => {
    await apiRequest('/api/v1/branch-health/weights', {
      method: 'PUT',
      body: weights,
    });
    setHealthWeights(weights);
  };

  const resetHealthWeights = async () => {
    await updateHealthWeights({ ...DEFAULT_HEALTH_WEIGHTS });
  };

  const saveFiscalYear = async (payload: FiscalYearConfig) => {
    await apiRequest('/api/v1/settings/fiscal-year', {
      method: 'PUT',
      body: {
        startDate: payload.startDate,
        endDate: payload.endDate,
        pillarTargets: payload.pillarTargets?.map((pt) => ({
          pillar: pt.pillar,
          monthlyTarget: pt.monthlyTarget,
        })),
      },
    });
    await refreshWorkspaceData();
  };

  const updateBranchProfile = async (payload: {
    managerName?: string;
    managerNameAr?: string;
    businessDate?: string;
    targetDailyRevenue?: number;
  }) => {
    await apiRequest('/api/v1/settings/branch-profile', {
      method: 'PATCH',
      body: payload,
    });
    const me = await apiRequest<{ user: AuthUser }>('/api/v1/auth/me');
    setUser(me.user);
    await refreshWorkspaceData();
  };

  // Server-side grounded Gemini Diagnostics
  const runAiDiagnostic = async () => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      const targetBranch =
        user?.role === 'STORE_MANAGER'
          ? user.branchCode || undefined
          : selectedBranchCode || user?.authorizedBranches[0]?.code || undefined;

      const result = await apiRequest<AIAnalysisResult>('/api/v1/ai/diagnostics/analyze', {
        method: 'POST',
        body: {
          branchCode: targetBranch,
          language,
        },
      });
      setAiAnalysis(result);
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Unable to run AI diagnostic analysis.'
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const toggleActionPlanItem = (itemId: string) => {
    if (!aiAnalysis) return;
    setAiAnalysis({
      ...aiAnalysis,
      actionPlan: aiAnalysis.actionPlan.map((item) =>
        item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
      ),
    });
  };

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        theme,
        setTheme,
        t,
        authLoading,
        dataLoading,
        databaseUnavailable,
        databaseErrorMessage,
        missingDbVars,
        geminiConfigured,
        refreshHealth,
        user,
        isAuthenticated,
        canEdit,
        configuredBranches,
        unconfiguredBranches,
        authorizedBranches,
        selectedBranchCode,
        setSelectedBranchCode,
        currentBranch,
        dateRange,
        setDateRange,
        fiscalYear,
        refreshWorkspaceData,
        reloadBranchesCatalog,
        loginBranch,
        loginArea,
        logout,
        logoutAll,
        dashboardData,
        tasks,
        employees,
        salesBoxes,
        cases,
        healthWeights,
        aiAnalysis,
        isAiLoading,
        aiError,
        opsCompletionPercentage,
        totalTasksCount,
        completedTasksCount,
        pendingTasksCount,
        overdueTasksCount,
        blockedTasksCount,
        criticalAlerts,
        overallHealthScore,
        healthCategories,
        weakestHealthArea,
        strongestHealthArea,
        salesOverallAchievement,
        employeesNeedingCoachingCount,
        pendingCasesCount,
        repeatedCasesCount,
        addTask,
        updateTask,
        deleteTask,
        updateTaskStatus,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        addCoachingSession,
        addSalesBox,
        updateSalesBox,
        deleteSalesBox,
        addCase,
        updateCase,
        deleteCase,
        updateHealthWeights,
        resetHealthWeights,
        saveFiscalYear,
        updateBranchProfile,
        runAiDiagnostic,
        toggleActionPlanItem,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider');
  return ctx;
};
