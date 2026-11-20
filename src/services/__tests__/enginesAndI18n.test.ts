import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  calculateRE,
  computeItemMetrics,
  DEFAULT_TARGET_ITEMS,
  generateWhatsAppMessage,
  parseNumericWeight,
} from '../targetCalculatorEngine.ts';
import {
  aggregateDailyTotalTnps,
  aggregateMonthlyRecords,
  calculateRequiredPromotersForBenchmark,
  computeSingleAgentTnps,
  type DailyTnpsRecord,
} from '../tnpsCalculatorEngine.ts';
import {
  computeAchievementPercent,
  isMonthInFiscalYear,
  matchesDateOverlapFilter,
  monthlyAverageAchievement,
} from '../../server/services/domainCalculations.ts';
import { parseSpreadsheetBuffer } from '../../server/services/csvXlsx.ts';
import { translations } from '../../i18n/translations.ts';

describe('Calculation Engines, Domain Aggregations & EN/AR Translation Parity', () => {
  it('computes Target Calculator weights, item RE%, and renders Unconfigured when tnpsPercent is null', () => {
    assert.equal(parseNumericWeight('٦٠%'), 60);
    assert.equal(parseNumericWeight('15.5'), 15.5);
    assert.equal(parseNumericWeight('-5'), 5); // non-numeric chars stripped before parseFloat

    const computedItems = {
      ...Object.fromEntries(
        Object.entries(DEFAULT_TARGET_ITEMS).map(([k, v]) => [
          k,
          computeItemMetrics(v, 25, 10),
        ])
      ),
      acq_low: computeItemMetrics(
        { id: 'acq_low', name: 'Low Acq', shortName: 'Acq Low', monthlyTarget: '100', mtdAchievement: '60', todayAch: '4' },
        25,
        10
      ),
    };

    assert.equal(computedItems.acq_low.remainingTarget, 40);
    assert.equal(computedItems.acq_low.dailyTarget, 4);
    assert.equal(computedItems.acq_low.mtdPercent, 60);
    assert.equal(calculateRE(60, 100, 15, 25), 100);
    assert.equal(calculateRE(10, 0, 15, 25), 'N/A');

    const msgUnconfigured = generateWhatsAppMessage({
      storeName: '1750 - Abo ElMatamer',
      dateStr: '2026-11-19',
      computedItems,
      acqBox: { todayAch: 4, dailyTarget: 4, mtdAchievement: 60, monthlyTarget: 100 },
      terminalBox: { todayAch: 0, dailyTarget: 0, mtdAchievement: 0, monthlyTarget: 0 },
      enterpriseBox: { todayAch: 0, dailyTarget: 0, mtdAchievement: 0, monthlyTarget: 0 },
      fixedBox: { todayAch: 0, dailyTarget: 0, mtdAchievement: 0, monthlyTarget: 0 },
      redSalesToday: '0',
      redSalesTarget: '0',
      overallProjectionPercent: 100,
      tnpsPercent: null,
      elapsedShifts: 15,
      totalShifts: 25,
    });
    assert.ok(msgUnconfigured.includes('TNPS: Unconfigured'));
    assert.ok(!msgUnconfigured.includes('65%'));

    const msgNumeric = generateWhatsAppMessage({
      storeName: '1750 - Abo ElMatamer',
      dateStr: '2026-11-19',
      computedItems,
      acqBox: { todayAch: 4, dailyTarget: 4, mtdAchievement: 60, monthlyTarget: 100 },
      terminalBox: { todayAch: 0, dailyTarget: 0, mtdAchievement: 0, monthlyTarget: 0 },
      enterpriseBox: { todayAch: 0, dailyTarget: 0, mtdAchievement: 0, monthlyTarget: 0 },
      fixedBox: { todayAch: 0, dailyTarget: 0, mtdAchievement: 0, monthlyTarget: 0 },
      redSalesToday: '0',
      redSalesTarget: '0',
      overallProjectionPercent: 100,
      tnpsPercent: 78,
      elapsedShifts: 15,
      totalShifts: 25,
    });
    assert.ok(msgNumeric.includes('TNPS: 78%'));
  });

  it('computes TNPS agent rows, required promoters for arbitrary benchmark, and monthly summary', () => {
    const reqFor70 = calculateRequiredPromotersForBenchmark(2, 1, 5, 70);
    assert.ok(reqFor70 > 0);
    assert.equal(calculateRequiredPromotersForBenchmark(0, 0, 5, 70), 0);

    const row = computeSingleAgentTnps(
      { id: '1', agentName: 'Agent A', detractors: 1, passive: 1, promoters: 8 },
      5,
      70
    );
    assert.equal(row.total, 10);
    assert.equal(row.tnpsPercent, 70);
    assert.equal(row.requiredPromoters, 0);

    const agg = aggregateDailyTotalTnps([row], 5, 70);
    assert.equal(agg.tnpsPercent, 70);

    const monthlyRecords: DailyTnpsRecord[] = [
      {
        id: 'd1',
        branchCode: '1750',
        businessDate: '2026-11-01',
        agentRows: [],
        totalDetractors: 1,
        totalPassive: 1,
        totalPromoters: 8,
        totalResponses: 10,
        dailyTnpsPercent: 70,
        requiredPromoters: 0,
        dailyRequired: 0,
        targetBenchmark: 70,
        updatedAt: '2026-11-01T10:00:00.000Z',
        updatedBy: 'Manager',
        revisionNumber: 1,
      },
      {
        id: 'd2',
        branchCode: '1750',
        businessDate: '2026-11-02',
        agentRows: [],
        totalDetractors: 0,
        totalPassive: 2,
        totalPromoters: 8,
        totalResponses: 10,
        dailyTnpsPercent: 80,
        requiredPromoters: 0,
        dailyRequired: 0,
        targetBenchmark: 70,
        updatedAt: '2026-11-02T10:00:00.000Z',
        updatedBy: 'Manager',
        revisionNumber: 1,
      },
    ];

    const summary = aggregateMonthlyRecords(monthlyRecords, 25, 70);
    assert.equal(summary.totalDaysLogged, 2);
    assert.equal(summary.dayOverDayVariance, 10);
    assert.equal(summary.bestDay?.date, '2026-11-02');
    assert.equal(summary.isTargetMet, true);
  });

  it('computes domain achievement percentages (null when target missing/0), FY bounds, date overlap filtering, and arithmetic average', () => {
    assert.equal(computeAchievementPercent(50, null), null);
    assert.equal(computeAchievementPercent(50, 0), null);
    assert.equal(computeAchievementPercent(75, 100), 75);

    assert.equal(isMonthInFiscalYear('2026-04'), true);
    assert.equal(isMonthInFiscalYear('2027-03'), true);
    assert.equal(isMonthInFiscalYear('2026-03'), false);
    assert.equal(isMonthInFiscalYear('2027-04'), false);

    assert.equal(
      matchesDateOverlapFilter(
        { startDate: '2026-10-28', dueDate: '2026-11-05' },
        { fromDate: '2026-11-01', toDate: '2026-11-30' }
      ),
      true
    );
    assert.equal(
      matchesDateOverlapFilter(
        { month: '2026-10' },
        { fromDate: '2026-11-01', toDate: '2026-11-30' }
      ),
      false
    );

    const avg = monthlyAverageAchievement([
      { month: '2026-10', pillar: 'Acquisition', actual: 100, target: 100 },
      { month: '2026-11', pillar: 'Acquisition', actual: 150, target: 100 },
      { month: '2026-12', pillar: 'Acquisition', actual: 40, target: null },
    ]);
    assert.equal(avg, 125);
  });

  it('parses all Excel and delimited spreadsheet formats (.xlsx, .xls, semicolon CSV, tab TSV)', async () => {
    const sampleRows = [
      ['Date', 'Agent Name', 'Score'],
      [new Date('2026-11-19T00:00:00Z'), 'Ahmed Ali', 92],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const parsedXlsx = await parseSpreadsheetBuffer(xlsxBuf, 'xlsx', 'report.xlsx');
    assert.equal(parsedXlsx.length, 2);
    assert.deepEqual(parsedXlsx[0], ['Date', 'Agent Name', 'Score']);
    assert.equal(parsedXlsx[1][1], 'Ahmed Ali');
    assert.equal(parsedXlsx[1][2], '92');

    const xlsBuf = XLSX.write(wb, { type: 'buffer', bookType: 'biff8' }) as Buffer;
    const parsedXls = await parseSpreadsheetBuffer(xlsBuf, 'xls', 'legacy.xls');
    assert.equal(parsedXls.length, 2);
    assert.equal(parsedXls[1][1], 'Ahmed Ali');

    const semiCsv = Buffer.from('\uFEFFAgent Name;Score;Date\r\nSara;88;2026-11-19', 'utf8');
    const parsedSemi = await parseSpreadsheetBuffer(semiCsv, 'csv', 'eu.csv');
    assert.deepEqual(parsedSemi, [
      ['Agent Name', 'Score', 'Date'],
      ['Sara', '88', '2026-11-19'],
    ]);

    const tsvBuf = Buffer.from('Agent Name\tScore\nOmar\t95', 'utf8');
    const parsedTsv = await parseSpreadsheetBuffer(tsvBuf, 'tsv', 'export.tsv');
    assert.deepEqual(parsedTsv, [
      ['Agent Name', 'Score'],
      ['Omar', '95'],
    ]);
  });

  it('maintains 100% EN/AR translation key parity with zero empty strings', () => {
    const enKeys = Object.keys(translations.en).sort();
    const arKeys = Object.keys(translations.ar).sort();

    assert.deepEqual(enKeys, arKeys, 'EN and AR translation key sets must match identically');

    for (const k of enKeys) {
      const enVal = (translations.en as Record<string, string>)[k];
      const arVal = (translations.ar as Record<string, string>)[k];
      assert.equal(typeof enVal, 'string');
      assert.equal(typeof arVal, 'string');
      assert.ok(enVal.trim().length > 0, `Empty EN translation for key "${k}"`);
      assert.ok(arVal.trim().length > 0, `Empty AR translation for key "${k}"`);
    }
  });
});
