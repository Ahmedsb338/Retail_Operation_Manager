import * as dotenv from 'dotenv';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { getDb, getPostgresPool, isDatabaseConfigured } from '../src/db/index.ts';
import { seedVerifiedReferenceCatalog } from '../src/db/referenceSeed.ts';
import {
  provisionAreaManager,
  provisionBranchCredential,
  revokeAreaManagerAccess,
  revokeBranchAccess,
} from '../src/server/services/provisioning.ts';

dotenv.config();

function getArg(flag: string): string | undefined {
  const prefix = `--${flag}=`;
  const match = process.argv.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

async function promptSecret(label: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(label);
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.error(
      'Database configuration missing. Set SQL_HOST, SQL_DB_NAME, SQL_USER, and SQL_PASSWORD before running provisioning commands.'
    );
    process.exit(1);
  }

  const db = getDb();
  const action = getArg('action');

  if (action === 'seed-reference') {
    await seedVerifiedReferenceCatalog(db);
    console.log('Verified reference catalog (Branch 1750 + 13 unconfigured branch names) initialized.');
    return;
  }

  if (action === 'provision-branch') {
    const branchCode = getArg('branch') || '';
    const managerName = getArg('manager');
    const area = getArg('area');
    const accessCode = await promptSecret(`Enter new Branch Access Code for branch ${branchCode}: `);
    const result = await provisionBranchCredential(db, {
      branchCode,
      accessCode,
      managerName,
      area,
      actorIdentifier: 'operator_cli',
    });
    console.log(`Provisioned branch ${result.branchCode} credential (tokenVersion=${result.tokenVersion}).`);
    return;
  }

  if (action === 'provision-area-manager') {
    const username = getArg('username') || '';
    const displayName = getArg('display-name') || username;
    const area = getArg('area') || '';
    const branchCode = getArg('branch');
    const password = await promptSecret(`Enter password (min 12 chars) for Area Manager ${username}: `);
    const created = await provisionAreaManager(db, {
      username,
      displayName,
      password,
      mustRotatePassword: true,
      assignments: [{ areaName: area, branchCode: branchCode || null }],
      actorIdentifier: 'operator_cli',
    });
    console.log(`Provisioned Area Manager ${created.username} (id=${created.id}).`);
    return;
  }

  if (action === 'revoke-branch') {
    const branchCode = getArg('branch') || '';
    await revokeBranchAccess(db, branchCode, 'operator_cli');
    console.log(`Revoked branch ${branchCode} credentials and active sessions.`);
    return;
  }

  if (action === 'revoke-area-manager') {
    const id = getArg('id') || '';
    await revokeAreaManagerAccess(db, id, 'operator_cli');
    console.log(`Revoked Area Manager ${id} access and active sessions.`);
    return;
  }

  console.log(
    [
      'ASB Workforce Account Provisioning CLI',
      'Usage:',
      '  tsx scripts/provision-account.ts --action=seed-reference',
      '  tsx scripts/provision-account.ts --action=provision-branch --branch=1750 --area="El Beheira"',
      '  tsx scripts/provision-account.ts --action=provision-area-manager --username=... --area="El Beheira" [--branch=1750]',
      '  tsx scripts/provision-account.ts --action=revoke-branch --branch=1750',
      '  tsx scripts/provision-account.ts --action=revoke-area-manager --id=<uuid>',
    ].join('\n')
  );
}

main()
  .catch((err) => {
    console.error('Provisioning failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPostgresPool().end();
    } catch {
      // ignore if pool was never initialized
    }
  });
