import React from 'react';
import { OperationalTableModule } from '../shared/OperationalTableModule';

const PILLAR_OPTIONS = [
  { value: 'Gross Adds', label: 'Gross Adds', labelAr: 'المشتركين الجدد (Gross Adds)' },
  { value: 'Red & Flex', label: 'Red & Flex', labelAr: 'خطوط ريد وفليكس (Red & Flex)' },
  { value: 'VF Cash', label: 'VF Cash', labelAr: 'فودافون كاش (VF Cash)' },
  { value: 'Fixed', label: 'Fixed', labelAr: 'الإنترنت المنزلي (Fixed)' },
  { value: 'Enterprise', label: 'Enterprise', labelAr: 'قطاع الشركات (Enterprise)' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const currentMonthIso = () => new Date().toISOString().slice(0, 7);

export const StoreRpmView: React.FC = () => (
  <OperationalTableModule
    title="Store RPM"
    titleAr="تقييم الفرع الشهري (Store RPM)"
    subtitle="Monthly store pillar actuals, targets, and computed achievement %"
    subtitleAr="متابعة إنجاز ركائز الفرع الشهرية والمستهدفات المحسوبة"
    endpoint="/api/v1/store-rpm"
    exportFilename="store_rpm"
    metaField="notes"
    importHeadersHint="Month (YYYY-MM), Pillar (Gross Adds | Red & Flex | VF Cash | Fixed | Enterprise), Actual, Target, Notes"
    defaultNewValues={() => ({
      month: currentMonthIso(),
      pillar: 'Gross Adds',
      actual: '',
      target: '',
      notes: '',
    })}
    columns={[
      { key: 'month', label: 'Month', labelAr: 'الشهر', isNumeric: true },
      { key: 'pillar', label: 'Pillar', labelAr: 'الركيزة' },
      { key: 'actual', label: 'Actual', labelAr: 'المحقق', isNullableMetric: true },
      { key: 'target', label: 'Target', labelAr: 'المستهدف', isNullableMetric: true },
      {
        key: 'achievementPercent',
        label: 'Achievement %',
        labelAr: 'نسبة الإنجاز',
        isNullableMetric: true,
        suffix: '%',
      },
      { key: 'notes', label: 'Notes', labelAr: 'ملاحظات' },
    ]}
    fields={[
      { key: 'month', label: 'Month (YYYY-MM)', labelAr: 'الشهر', type: 'month', required: true },
      {
        key: 'pillar',
        label: 'Pillar',
        labelAr: 'الركيزة',
        type: 'select',
        required: true,
        options: PILLAR_OPTIONS,
      },
      { key: 'actual', label: 'Actual', labelAr: 'المحقق', type: 'number', nullable: true },
      { key: 'target', label: 'Target', labelAr: 'المستهدف', type: 'number', nullable: true },
      { key: 'notes', label: 'Notes', labelAr: 'ملاحظات', type: 'textarea' },
    ]}
  />
);

export const AgentRpmView: React.FC = () => (
  <OperationalTableModule
    title="Agent RPM"
    titleAr="تقييم الموظفين الشهري (Agent RPM)"
    subtitle="Agent pillar actuals, targets, SID attribution, and achievement %"
    subtitleAr="متابعة أداء الموظفين عبر ركائز المبيعات والخدمة"
    endpoint="/api/v1/agent-rpm"
    exportFilename="agent_rpm"
    metaField="notes"
    importHeadersHint="Agent Name, SID, Month (YYYY-MM), Pillar, Actual, Target, Notes"
    defaultNewValues={() => ({
      agentName: '',
      sid: '',
      month: currentMonthIso(),
      pillar: 'Gross Adds',
      actual: '',
      target: '',
      notes: '',
    })}
    columns={[
      { key: 'agentName', label: 'Agent Name', labelAr: 'الموظف' },
      { key: 'sid', label: 'SID', labelAr: 'الكود', isNumeric: true },
      { key: 'month', label: 'Month', labelAr: 'الشهر', isNumeric: true },
      { key: 'pillar', label: 'Pillar', labelAr: 'الركيزة' },
      { key: 'actual', label: 'Actual', labelAr: 'المحقق', isNullableMetric: true },
      { key: 'target', label: 'Target', labelAr: 'المستهدف', isNullableMetric: true },
      {
        key: 'achievementPercent',
        label: 'Achievement %',
        labelAr: 'نسبة الإنجاز',
        isNullableMetric: true,
        suffix: '%',
      },
    ]}
    fields={[
      { key: 'agentName', label: 'Agent Name', labelAr: 'اسم الموظف', type: 'text', required: true },
      { key: 'sid', label: 'SID', labelAr: 'الكود الوظيفي', type: 'text' },
      { key: 'month', label: 'Month (YYYY-MM)', labelAr: 'الشهر', type: 'month', required: true },
      {
        key: 'pillar',
        label: 'Pillar',
        labelAr: 'الركيزة',
        type: 'select',
        required: true,
        options: PILLAR_OPTIONS,
      },
      { key: 'actual', label: 'Actual', labelAr: 'المحقق', type: 'number', nullable: true },
      { key: 'target', label: 'Target', labelAr: 'المستهدف', type: 'number', nullable: true },
      { key: 'notes', label: 'Notes', labelAr: 'ملاحظات', type: 'textarea' },
    ]}
  />
);

export const StoreKpisView: React.FC = () => (
  <OperationalTableModule
    title="Store KPIs"
    titleAr="مؤشرات أداء الفرع (Store KPIs)"
    subtitle="Monthly store KPI targets, actuals, and achievement tracking"
    subtitleAr="تتبع مؤشرات الأداء الرئيسية الشهرية للفرع"
    endpoint="/api/v1/store-kpis"
    exportFilename="store_kpis"
    metaField="notes"
    importHeadersHint="Month (YYYY-MM), KPI Name, Actual, Target, Notes"
    defaultNewValues={() => ({
      month: currentMonthIso(),
      kpiName: '',
      actual: '',
      target: '',
      notes: '',
    })}
    columns={[
      { key: 'month', label: 'Month', labelAr: 'الشهر', isNumeric: true },
      { key: 'kpiName', label: 'KPI Name', labelAr: 'اسم المؤشر' },
      { key: 'actual', label: 'Actual', labelAr: 'المحقق', isNullableMetric: true },
      { key: 'target', label: 'Target', labelAr: 'المستهدف', isNullableMetric: true },
      {
        key: 'achievementPercent',
        label: 'Achievement %',
        labelAr: 'نسبة الإنجاز',
        isNullableMetric: true,
        suffix: '%',
      },
      { key: 'notes', label: 'Notes', labelAr: 'ملاحظات' },
    ]}
    fields={[
      { key: 'month', label: 'Month (YYYY-MM)', labelAr: 'الشهر', type: 'month', required: true },
      { key: 'kpiName', label: 'KPI Name', labelAr: 'اسم المؤشر', type: 'text', required: true },
      { key: 'actual', label: 'Actual', labelAr: 'المحقق', type: 'number', nullable: true },
      { key: 'target', label: 'Target', labelAr: 'المستهدف', type: 'number', nullable: true },
      { key: 'notes', label: 'Notes', labelAr: 'ملاحظات', type: 'textarea' },
    ]}
  />
);

export const AgentKpisView: React.FC = () => (
  <OperationalTableModule
    title="Agent KPIs"
    titleAr="مؤشرات أداء الموظفين (Agent KPIs)"
    subtitle="Individual agent KPIs, monthly scores, and targets"
    subtitleAr="متابعة مؤشرات الأداء الفردية للموظفين"
    endpoint="/api/v1/agent-kpis"
    exportFilename="agent_kpis"
    metaField="notes"
    importHeadersHint="Agent Name, SID, Month (YYYY-MM), KPI Name, Actual, Target, Notes"
    defaultNewValues={() => ({
      agentName: '',
      sid: '',
      month: currentMonthIso(),
      kpiName: '',
      actual: '',
      target: '',
      notes: '',
    })}
    columns={[
      { key: 'agentName', label: 'Agent Name', labelAr: 'الموظف' },
      { key: 'sid', label: 'SID', labelAr: 'الكود', isNumeric: true },
      { key: 'month', label: 'Month', labelAr: 'الشهر', isNumeric: true },
      { key: 'kpiName', label: 'KPI Name', labelAr: 'المؤشر' },
      { key: 'actual', label: 'Actual', labelAr: 'المحقق', isNullableMetric: true },
      { key: 'target', label: 'Target', labelAr: 'المستهدف', isNullableMetric: true },
      {
        key: 'achievementPercent',
        label: 'Achievement %',
        labelAr: 'نسبة الإنجاز',
        isNullableMetric: true,
        suffix: '%',
      },
    ]}
    fields={[
      { key: 'agentName', label: 'Agent Name', labelAr: 'اسم الموظف', type: 'text', required: true },
      { key: 'sid', label: 'SID', labelAr: 'الكود الوظيفي', type: 'text' },
      { key: 'month', label: 'Month (YYYY-MM)', labelAr: 'الشهر', type: 'month', required: true },
      { key: 'kpiName', label: 'KPI Name', labelAr: 'اسم المؤشر', type: 'text', required: true },
      { key: 'actual', label: 'Actual', labelAr: 'المحقق', type: 'number', nullable: true },
      { key: 'target', label: 'Target', labelAr: 'المستهدف', type: 'number', nullable: true },
      { key: 'notes', label: 'Notes', labelAr: 'ملاحظات', type: 'textarea' },
    ]}
  />
);

export const TnpsStoreLogsView: React.FC = () => (
  <OperationalTableModule
    title="TNPS Store Logs"
    titleAr="سجل TNPS للفرع"
    subtitle="Monthly store TNPS measurements and daily calculator snapshots"
    subtitleAr="سجلات TNPS الشهرية ولقطات حاسبة TNPS اليومية للفرع"
    endpoint="/api/v1/tnps-store"
    exportFilename="tnps_store"
    metaField="notes"
    importHeadersHint="Month (YYYY-MM), Business Date, Detractors, Passive, Promoters, Score, Benchmark, Notes"
    defaultNewValues={() => ({
      month: currentMonthIso(),
      businessDate: todayIso(),
      agentName: '',
      detractors: '',
      passive: '',
      promoters: '',
      score: '',
      benchmark: '70',
      notes: '',
    })}
    columns={[
      { key: 'month', label: 'Month', labelAr: 'الشهر', isNumeric: true },
      { key: 'businessDate', label: 'Date', labelAr: 'التاريخ', isNumeric: true },
      { key: 'recordType', label: 'Source', labelAr: 'المصدر' },
      { key: 'detractors', label: 'Detractors', labelAr: 'غير راضين', isNullableMetric: true },
      { key: 'passive', label: 'Passive', labelAr: 'محايدين', isNullableMetric: true },
      { key: 'promoters', label: 'Promoters', labelAr: 'داعمين', isNullableMetric: true },
      { key: 'score', label: 'Score %', labelAr: 'النتيجة', isNullableMetric: true, suffix: '%' },
      { key: 'benchmark', label: 'Benchmark %', labelAr: 'المستهدف', isNullableMetric: true, suffix: '%' },
    ]}
    fields={[
      { key: 'month', label: 'Month (YYYY-MM)', labelAr: 'الشهر', type: 'month', required: true },
      { key: 'businessDate', label: 'Business Date', labelAr: 'تاريخ القياس', type: 'date' },
      { key: 'agentName', label: 'Agent / Note Ref', labelAr: 'مرجع / موظف', type: 'text' },
      { key: 'detractors', label: 'Detractors', labelAr: 'غير راضين', type: 'integer', nullable: true },
      { key: 'passive', label: 'Passive', labelAr: 'محايدين', type: 'integer', nullable: true },
      { key: 'promoters', label: 'Promoters', labelAr: 'داعمين', type: 'integer', nullable: true },
      { key: 'score', label: 'TNPS Score %', labelAr: 'النتيجة', type: 'number', nullable: true },
      { key: 'benchmark', label: 'Benchmark %', labelAr: 'المعيار المستهدف', type: 'number', nullable: true },
      { key: 'notes', label: 'Notes', labelAr: 'ملاحظات', type: 'textarea' },
    ]}
  />
);

export const TnpsAgentsView: React.FC = () => (
  <OperationalTableModule
    title="TNPS Agents"
    titleAr="نتائج TNPS للموظفين"
    subtitle="Monthly individual agent TNPS scorecards and benchmarks"
    subtitleAr="بطاقات نتائج TNPS الفردية للموظفين"
    endpoint="/api/v1/tnps-agents"
    exportFilename="tnps_agents"
    metaField="notes"
    importHeadersHint="Agent Name, SID, Month (YYYY-MM), Score, Benchmark, Notes"
    defaultNewValues={() => ({
      agentName: '',
      sid: '',
      month: currentMonthIso(),
      score: '',
      benchmark: '70',
      notes: '',
    })}
    columns={[
      { key: 'agentName', label: 'Agent Name', labelAr: 'الموظف' },
      { key: 'sid', label: 'SID', labelAr: 'الكود', isNumeric: true },
      { key: 'month', label: 'Month', labelAr: 'الشهر', isNumeric: true },
      { key: 'score', label: 'TNPS Score %', labelAr: 'النتيجة', isNullableMetric: true, suffix: '%' },
      { key: 'benchmark', label: 'Benchmark %', labelAr: 'المعيار', isNullableMetric: true, suffix: '%' },
      { key: 'achievementPercent', label: 'Achievement %', labelAr: 'التحقيق', isNullableMetric: true, suffix: '%' },
      { key: 'notes', label: 'Notes', labelAr: 'ملاحظات' },
    ]}
    fields={[
      { key: 'agentName', label: 'Agent Name', labelAr: 'اسم الموظف', type: 'text', required: true },
      { key: 'sid', label: 'SID', labelAr: 'الكود الوظيفي', type: 'text' },
      { key: 'month', label: 'Month (YYYY-MM)', labelAr: 'الشهر', type: 'month', required: true },
      { key: 'score', label: 'TNPS Score %', labelAr: 'النتيجة', type: 'number', nullable: true },
      { key: 'benchmark', label: 'Benchmark %', labelAr: 'المعيار', type: 'number', nullable: true },
      { key: 'notes', label: 'Notes', labelAr: 'ملاحظات', type: 'textarea' },
    ]}
  />
);

export const ScheduleExceptionsView: React.FC = () => (
  <OperationalTableModule
    title="Schedule Exceptions"
    titleAr="استثناءات جدول الورديات"
    subtitle="Shift swaps, emergency leave, medical excuses, and schedule adjustments"
    subtitleAr="تبديل الورديات، الإجازات الطارئة، والتعديلات المعتمدة على الجدول"
    endpoint="/api/v1/schedule-exceptions"
    exportFilename="schedule_exceptions"
    metaField="reason"
    importHeadersHint="Agent Name, Date (YYYY-MM-DD), Exception Type, Reason, Approved By"
    defaultNewValues={() => ({
      agentName: '',
      date: todayIso(),
      exceptionType: 'Shift Swap',
      reason: '',
      approvedBy: '',
    })}
    columns={[
      { key: 'date', label: 'Date', labelAr: 'التاريخ', isNumeric: true },
      { key: 'agentName', label: 'Agent Name', labelAr: 'الموظف' },
      { key: 'exceptionType', label: 'Exception Type', labelAr: 'نوع الاستثناء' },
      { key: 'reason', label: 'Reason', labelAr: 'السبب' },
      { key: 'approvedBy', label: 'Approved By', labelAr: 'المعتمد' },
    ]}
    fields={[
      { key: 'agentName', label: 'Agent Name', labelAr: 'اسم الموظف', type: 'text', required: true },
      { key: 'date', label: 'Date', labelAr: 'التاريخ', type: 'date', required: true },
      { key: 'exceptionType', label: 'Exception Type', labelAr: 'نوع الاستثناء', type: 'text', required: true },
      { key: 'reason', label: 'Reason', labelAr: 'السبب', type: 'textarea' },
      { key: 'approvedBy', label: 'Approved By', labelAr: 'تم الاعتماد بواسطة', type: 'text' },
    ]}
  />
);

export const HrActionsView: React.FC = () => (
  <OperationalTableModule
    title="HR Actions"
    titleAr="إجراءات الموارد البشرية"
    subtitle="Warnings, performance notices, recognitions, and administrative HR tracking"
    subtitleAr="متابعة الإنذارات، الإشعارات الإدارية، والتقدير الوظيفي"
    endpoint="/api/v1/hr-actions"
    exportFilename="hr_actions"
    metaField="notes"
    importHeadersHint="Agent Name, Date (YYYY-MM-DD), Action, Status, Owner, Notes"
    defaultNewValues={() => ({
      agentName: '',
      date: todayIso(),
      action: '',
      status: 'Open',
      owner: '',
      notes: '',
    })}
    columns={[
      { key: 'date', label: 'Date', labelAr: 'التاريخ', isNumeric: true },
      { key: 'agentName', label: 'Agent Name', labelAr: 'الموظف' },
      { key: 'action', label: 'HR Action', labelAr: 'الإجراء' },
      { key: 'status', label: 'Status', labelAr: 'الحالة' },
      { key: 'owner', label: 'Owner', labelAr: 'المسؤول' },
      { key: 'notes', label: 'Notes', labelAr: 'ملاحظات' },
    ]}
    fields={[
      { key: 'agentName', label: 'Agent Name', labelAr: 'اسم الموظف', type: 'text', required: true },
      { key: 'date', label: 'Date', labelAr: 'التاريخ', type: 'date', required: true },
      { key: 'action', label: 'Action', labelAr: 'الإجراء', type: 'text', required: true },
      { key: 'status', label: 'Status', labelAr: 'الحالة', type: 'text', required: true },
      { key: 'owner', label: 'Owner', labelAr: 'المسؤول', type: 'text' },
      { key: 'notes', label: 'Notes', labelAr: 'ملاحظات', type: 'textarea' },
    ]}
  />
);

export const LateOpeningView: React.FC = () => (
  <OperationalTableModule
    title="Late Opening"
    titleAr="سجل تأخير فتح الفرع"
    subtitle="Planned vs actual opening time logs; blank delay remains Unconfigured until entered"
    subtitleAr="متابعة أوقات الفتح المخططة والفعلية؛ مدة التأخير غير المدخلة تبقى غير مُعدة"
    endpoint="/api/v1/late-opening"
    exportFilename="late_opening"
    metaField="reason"
    importHeadersHint="Date (YYYY-MM-DD), Planned Opening, Actual Opening, Delay Minutes, Responsible, Reason, Agent Name"
    defaultNewValues={() => ({
      agentName: '',
      date: todayIso(),
      plannedOpening: '09:00',
      actualOpening: '',
      delayMinutes: '',
      reason: '',
      responsible: '',
    })}
    columns={[
      { key: 'date', label: 'Date', labelAr: 'التاريخ', isNumeric: true },
      { key: 'plannedOpening', label: 'Planned', labelAr: 'المخطط', isNumeric: true },
      { key: 'actualOpening', label: 'Actual', labelAr: 'الفعلي', isNumeric: true },
      {
        key: 'delayMinutes',
        label: 'Delay (min)',
        labelAr: 'التأخير (دقيقة)',
        isNullableMetric: true,
        suffix: ' min',
      },
      { key: 'responsible', label: 'Responsible', labelAr: 'المسؤول' },
      { key: 'reason', label: 'Reason', labelAr: 'السبب' },
    ]}
    fields={[
      { key: 'date', label: 'Date', labelAr: 'التاريخ', type: 'date', required: true },
      { key: 'plannedOpening', label: 'Planned Opening (HH:MM)', labelAr: 'وقت الفتح المخطط', type: 'text' },
      { key: 'actualOpening', label: 'Actual Opening (HH:MM)', labelAr: 'وقت الفتح الفعلي', type: 'text' },
      { key: 'delayMinutes', label: 'Delay Minutes (leave blank for Unconfigured)', labelAr: 'دقائق التأخير (اتركه فارغاً لغير مُعد)', type: 'integer', nullable: true },
      { key: 'responsible', label: 'Responsible', labelAr: 'المسؤول', type: 'text' },
      { key: 'agentName', label: 'Staff Reference (optional)', labelAr: 'الموظف المرتبط', type: 'text' },
      { key: 'reason', label: 'Reason', labelAr: 'السبب', type: 'textarea' },
    ]}
  />
);

export const ShortOverView: React.FC = () => (
  <OperationalTableModule
    title="Short & Over Cases"
    titleAr="حالات العجز والزيادة النقدية"
    subtitle="Cash drawer variance log; Net Amount is entered manually or marked Unconfigured when blank"
    subtitleAr="سجل فروق الخزينة النقدية (العجز والزيادة وصافي الفرق اليدوي)"
    endpoint="/api/v1/short-over"
    exportFilename="short_over"
    metaField="remarks"
    importHeadersHint="Date (YYYY-MM-DD), Agent Name, Short Amount, Over Amount, Net Amount, Remarks"
    defaultNewValues={() => ({
      agentName: '',
      date: todayIso(),
      shortAmount: '',
      overAmount: '',
      netAmount: '',
      remarks: '',
    })}
    columns={[
      { key: 'date', label: 'Date', labelAr: 'التاريخ', isNumeric: true },
      { key: 'agentName', label: 'Agent Name', labelAr: 'الموظف' },
      { key: 'shortAmount', label: 'Short', labelAr: 'العجز', isNullableMetric: true },
      { key: 'overAmount', label: 'Over', labelAr: 'الزيادة', isNullableMetric: true },
      { key: 'netAmount', label: 'Net Amount', labelAr: 'صافي الفرق', isNullableMetric: true },
      { key: 'remarks', label: 'Remarks', labelAr: 'ملاحظات' },
    ]}
    fields={[
      { key: 'date', label: 'Date', labelAr: 'التاريخ', type: 'date', required: true },
      { key: 'agentName', label: 'Agent Name', labelAr: 'اسم الموظف', type: 'text' },
      { key: 'shortAmount', label: 'Short Amount', labelAr: 'قيمة العجز', type: 'number', nullable: true },
      { key: 'overAmount', label: 'Over Amount', labelAr: 'قيمة الزيادة', type: 'number', nullable: true },
      { key: 'netAmount', label: 'Net Amount (manual)', labelAr: 'صافي الفرق (إدخال يدوي)', type: 'number', nullable: true },
      { key: 'remarks', label: 'Remarks', labelAr: 'ملاحظات', type: 'textarea' },
    ]}
  />
);

export const ActionPlansView: React.FC = () => (
  <OperationalTableModule
    title="Action Plans"
    titleAr="خطط العمل التصحيحية"
    subtitle="Store and agent remediation plans with before/after tracking and SLA dates"
    subtitleAr="متابعة خطط العمل التصحيحية، المالكين، مواعيد الإنجاز، والقياس قبل وبعد"
    endpoint="/api/v1/action-plans"
    exportFilename="action_plans"
    metaField="reason"
    importHeadersHint="Agent Name, Pillars, Reason, Suggested Actions, Owner, Start Date, Due Date, Status, Before Tracking, After Tracking"
    defaultNewValues={() => ({
      agentName: '',
      pillars: 'Gross Adds',
      reason: '',
      suggestedActions: '',
      owner: '',
      startDate: todayIso(),
      dueDate: todayIso(),
      status: 'open',
      beforeTracking: '',
      afterTracking: '',
    })}
    columns={[
      { key: 'agentName', label: 'Agent / Store', labelAr: 'الموظف / الفرع' },
      { key: 'pillars', label: 'Pillars', labelAr: 'الركائز' },
      { key: 'reason', label: 'Reason', labelAr: 'السبب' },
      { key: 'suggestedActions', label: 'Suggested Actions', labelAr: 'الإجراءات المقترحة' },
      { key: 'owner', label: 'Owner', labelAr: 'المسؤول' },
      { key: 'startDate', label: 'Start Date', labelAr: 'تاريخ البدء', isNumeric: true },
      { key: 'dueDate', label: 'Due Date', labelAr: 'تاريخ الاستحقاق', isNumeric: true },
      { key: 'status', label: 'Status', labelAr: 'الحالة' },
      { key: 'beforeTracking', label: 'Before', labelAr: 'قبل' },
      { key: 'afterTracking', label: 'After', labelAr: 'بعد' },
    ]}
    fields={[
      { key: 'agentName', label: 'Agent Name (optional for store plan)', labelAr: 'اسم الموظف', type: 'text' },
      { key: 'pillars', label: 'Pillars', labelAr: 'الركائز المستهدفة', type: 'text', required: true },
      { key: 'reason', label: 'Reason / Weakness', labelAr: 'السبب', type: 'textarea' },
      { key: 'suggestedActions', label: 'Suggested Actions', labelAr: 'الإجراءات المقترحة', type: 'textarea', required: true },
      { key: 'owner', label: 'Owner', labelAr: 'المسؤول', type: 'text' },
      { key: 'startDate', label: 'Start Date', labelAr: 'تاريخ البدء', type: 'date' },
      { key: 'dueDate', label: 'Due Date', labelAr: 'تاريخ الاستحقاق', type: 'date' },
      {
        key: 'status',
        label: 'Status',
        labelAr: 'الحالة',
        type: 'select',
        required: true,
        options: [
          { value: 'open', label: 'Open', labelAr: 'مفتوحة' },
          { value: 'in_progress', label: 'In Progress', labelAr: 'قيد التنفيذ' },
          { value: 'completed', label: 'Completed', labelAr: 'مكتملة' },
          { value: 'overdue', label: 'Overdue', labelAr: 'متأخرة' },
          { value: 'blocked', label: 'Blocked', labelAr: 'معطلة' },
        ],
      },
      { key: 'beforeTracking', label: 'Before Tracking', labelAr: 'القياس قبل', type: 'text' },
      { key: 'afterTracking', label: 'After Tracking', labelAr: 'القياس بعد', type: 'text' },
    ]}
  />
);
