import type { AppDatabase } from './index.ts';
import {
  branches,
  pillarTargets,
  systemConfigs,
  unconfiguredBranches,
} from './schema.ts';

export const VERIFIED_BRANCH_1750 = Object.freeze({
  code: '1750',
  storeId: '1750',
  name: 'Abo ElMatamer Mahkama St. Express Store',
  nameAr: 'فرع أبو المطامير - شارع المحكمة إكسبريس',
  city: 'El Beheira',
  cityAr: 'البحيرة',
  managerName: 'Store Manager',
  managerNameAr: 'مدير الفرع',
  area: '',
  businessDate: '2026-11-03',
  totalShifts: 25,
  remainingShifts: 10,
  targetDailyRevenue: 150000,
  isActive: true,
});

export const UNCONFIGURED_BRANCH_NAMES: readonly string[] = Object.freeze([
  'Al Alameen Express Store',
  'Wadi El Natrun Store',
  'Motobas Express Store',
  'ElNobareya Express Store',
  'Sidi Abd El-Rahman',
  'Alex ElWerdian Express Store',
  'Housh Eisa 23 July St Express Store',
  'Shabas ElShohdaa Express Store',
  'Damanhour ElRawda St Express Store',
  'Alex Agamy Hannoville Hotel Express Store',
  'ElReyad ElSafata Express Store',
  'Alex ElHadra Express Store',
  'Alex Abu Qir Express Store',
]);

export const STANDARD_PILLARS: readonly string[] = Object.freeze([
  'Acquisition',
  'Enterprise',
  'Terminal',
  'ADSL',
  'AT Home',
]);

export const SYSTEM_CONFIG_DEFAULTS: ReadonlyArray<{ key: string; value: string }> = Object.freeze([
  { key: 'financial_year_start', value: '2026-04-01' },
  { key: 'financial_year_end', value: '2027-03-31' },
  { key: 'default_language', value: 'en' },
  { key: 'system_version', value: '2.0.0' },
]);

/**
 * Idempotently seeds ONLY verified Branch 1750 reference identity, the 13
 * separated unconfigured branch names, unconfigured pillar placeholders, and
 * non-secret financial year system configs.
 *
 * Intentionally does NOT create any credentials, Area Manager accounts, or
 * operational demo records. Never executed automatically in production.
 */
export async function seedVerifiedReferenceCatalog(db: AppDatabase): Promise<void> {
  await db
    .insert(branches)
    .values({ ...VERIFIED_BRANCH_1750 })
    .onConflictDoNothing({ target: branches.code });

  if (UNCONFIGURED_BRANCH_NAMES.length > 0) {
    await db
      .insert(unconfiguredBranches)
      .values(
        UNCONFIGURED_BRANCH_NAMES.map((branchName, index) => ({
          branchName,
          displayOrder: index + 1,
        }))
      )
      .onConflictDoNothing({ target: unconfiguredBranches.branchName });
  }

  await db
    .insert(pillarTargets)
    .values(
      STANDARD_PILLARS.map((pillar) => ({
        pillar,
        monthlyTarget: null,
        unit: '%',
        isActive: true,
      }))
    )
    .onConflictDoNothing({ target: pillarTargets.pillar });

  await db
    .insert(systemConfigs)
    .values([...SYSTEM_CONFIG_DEFAULTS])
    .onConflictDoNothing({ target: systemConfigs.key });
}
