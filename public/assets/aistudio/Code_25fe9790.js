/**
 * Store Performance Management System
 * Google Apps Script backend.
 *
 * IMPORTANT:
 * 1) Create a NEW Google Spreadsheet for this system.
 * 2) Paste this file into Code.js and index.html into index.html.
 * 3) Run setupSystem() once from the Apps Script editor.
 * 4) Restrict spreadsheet access to trusted administrators only.
 *
 * Security model:
 * - Store Manager: branch-scoped read/write.
 * - Area Manager: area-scoped read-only.
 * - Agents: no accounts / no application access.
 * - Branch login uses Branch Name + Branch Code as requested.
 *   Because the Branch Code is also stored in BRANCHES, spreadsheet access
 *   must be restricted. For stronger security, use a separate secret code.
 */

const APP = Object.freeze({
  NAME: 'Store Performance Management',
  SESSION_TTL_SECONDS: 21600,
  FY_START_MONTH: 4, // April
  DEFAULT_YEAR: 2026,
  SHEETS: {
    // First four BRANCHES columns intentionally follow the user's exact order.
    BRANCHES: ['Branch Name', 'Branch Code', 'Manager Name', 'Area'],
    STORE_METADATA: ['Branch Code', 'Store Name', 'Store ID'],
    USERS: ['Record ID', 'Username', 'Password Hash', 'Role', 'Area', 'Active'],
    CONFIG: ['Key', 'Value'],
    TARGETS: ['Record ID', 'Pillar', 'Monthly Target', 'Unit', 'Active'],
    STORE_RPM: ['Record ID', 'Branch Code', 'Store Name', 'Store ID', 'Month', 'Pillar', 'Actual', 'Target', 'Achievement %', 'Notes'],
    AGENT_RPM: ['Record ID', 'Branch Code', 'Store Name', 'Store ID', 'Agent Name', 'SID', 'Month', 'Pillar', 'Actual', 'Target', 'Achievement %', 'Notes'],
    STORE_KPIS: ['Record ID', 'Branch Code', 'Store Name', 'Store ID', 'Month', 'KPI', 'Actual', 'Target', 'Achievement %', 'Notes'],
    AGENT_KPIS: ['Record ID', 'Branch Code', 'Store Name', 'Store ID', 'Agent Name', 'SID', 'Month', 'KPI', 'Actual', 'Target', 'Achievement %', 'Notes'],
    TNPS_STORE: ['Record ID', 'Branch Code', 'Store Name', 'Store ID', 'Agent Name', 'Month', 'Score', 'BM', 'Achievement %', 'Notes'],
    TNPS_AGENTS: ['Record ID', 'Branch Code', 'Store Name', 'Store ID', 'Agent Name', 'SID', 'Month', 'Score', 'BM', 'Achievement %', 'Notes'],
    COMPLAINTS: ['Record ID', 'Branch Code', 'Store Name', 'Store ID', 'Agent Name', 'Date', 'Case ID', 'Category', 'Status', 'Notes'],
    SCHEDULES: ['Record ID', 'Branch Code', 'Store Name', 'Store ID', 'Date', 'Agent Name', 'SID', 'Shift', 'Notes'],
    SCHEDULE_EXCEPTIONS: ['Record ID', 'Branch Code', 'Store Name', 'Store ID', 'Agent Name', 'Date', 'Exception Type', 'Reason', 'Approved By'],
    STORE_TASKS: ['Record ID', 'Branch Code', 'Store Name', 'Store ID', 'Agent Name', 'Date', 'Task', 'Owner', 'Status', 'Due Date', 'Notes'],
    HR_ACTIONS: ['Record ID', 'Branch Code', 'Store Name', 'Store ID', 'Agent Name', 'Date', 'Action', 'Status', 'Owner', 'Notes'],
    LATE_OPENING: ['Record ID', 'Branch Code', 'Store Name', 'Store ID', 'Agent Name', 'Date', 'Planned Opening', 'Actual Opening', 'Delay Minutes', 'Reason', 'Responsible'],
    SHORT_OVER: ['Record ID', 'Branch Code', 'Store Name', 'Store ID', 'Agent Name', 'Date', 'Short', 'Over', 'Net', 'Remarks'],
    ACTION_PLANS: ['Record ID', 'Branch Code', 'Store Name', 'Store ID', 'Agent Name', 'Pillar', 'Action', 'Owner', 'Start Date', 'Due Date', 'Status', 'Created At'],
    CUSTOM_FIELDS: ['Record ID', 'Sheet Name', 'Field Name', 'Created By', 'Created At'],
    AUDIT_LOG: ['Timestamp', 'Username', 'Role', 'Branch Code', 'Action', 'Sheet Name', 'Record ID', 'Details']
  },
  BRANCH_NAMES: [
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
    'Abo ElMatamer Mahkama St. Express Store',
    '',
    ''
  ],
  PILLARS: ['Acquisition', 'Enterprise', 'Terminal', 'ADSL', 'AT Home']
});

/** Include a client-side HTML partial (for example index-script.html). */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle(APP.NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

/** Run once from the Apps Script editor. Safe to run again; does not clear data. */
function setupSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open the Apps Script project from the target Google Spreadsheet.');

  Object.keys(APP.SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = APP.SHEETS[name];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, headers.length)
        .setBackground('#12345a').setFontColor('#ffffff').setFontWeight('bold');
      sh.autoResizeColumns(1, headers.length);
    } else {
      const current = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
      headers.forEach((h, i) => {
        if (current.indexOf(h) === -1) {
          const nextCol = sh.getLastColumn() + 1;
          sh.getRange(1, nextCol).setValue(h);
        }
      });
    }
  });

  normalizeBranchesSheet_();
  seedBranches_();
  seedStoreMetadata_();
  seedTargets_();
  migrateLegacyData_();
  seedDefaultAreaManager_();
  const config = ss.getSheetByName('CONFIG');
  if (config.getLastRow() === 1) {
    config.getRange(2, 1, 4, 2).setValues([
      ['Financial Year Start', '2026-04-01'],
      ['Financial Year End', '2027-03-31'],
      ['Default Language', 'en'],
      ['System Version', '2.0.0']
    ]);
  }
  return { ok: true, message: 'System initialized. Complete Store IDs, branch codes, manager names, areas and targets.' };
}

function normalizeBranchesSheet_() {
  const sh=SpreadsheetApp.getActive().getSheetByName('BRANCHES');
  if(!sh || sh.getLastRow()<1) return;
  const values=sh.getDataRange().getValues(), headers=values[0].map(String);
  const col=h=>headers.indexOf(h);
  const nameCol=col('Branch Name'), codeCol=col('Branch Code'), managerCol=col('Manager Name'), areaCol=col('Area'), storeIdCol=col('Store ID');
  const meta=SpreadsheetApp.getActive().getSheetByName('STORE_METADATA');
  if(storeIdCol>=0){
    const known=readObjects_('STORE_METADATA');
    const byCode=new Map(known.map(r=>[String(r['Branch Code']),r]));
    values.slice(1).forEach(r=>{
      const code=String(r[codeCol]||'').trim(), storeId=String(r[storeIdCol]||'').trim();
      if(code&&storeId&&!byCode.has(code)){meta.appendRow([code,String(r[nameCol]||''),storeId]);byCode.set(code,true);}
    });
  }
  const normalized=values.slice(1).map(r=>[
    nameCol>=0?r[nameCol]:'', codeCol>=0?r[codeCol]:'', managerCol>=0?r[managerCol]:'', areaCol>=0?r[areaCol]:''
  ]).filter(r=>r.some(v=>String(v||'').trim()!==''));
  if(normalized.some(r=>String(r[0]||'').trim())) while(normalized.length<16) normalized.push(['','','','']);
  sh.clearContents();
  sh.getRange(1,1,1,4).setValues([APP.SHEETS.BRANCHES]);
  if(normalized.length) sh.getRange(2,1,normalized.length,4).setValues(normalized);
  if(sh.getMaxColumns()>4) sh.deleteColumns(5,sh.getMaxColumns()-4);
  sh.setFrozenRows(1);
  sh.getRange(1,1,1,4).setBackground('#12345a').setFontColor('#ffffff').setFontWeight('bold');
}

function seedBranches_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('BRANCHES');
  if (sh.getLastRow() > 1) return; // Never overwrite existing branch data.
  const rows = APP.BRANCH_NAMES.map(name => [name, '', '', '']);
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  sh.setFrozenRows(1);
}

function seedStoreMetadata_() {
  const sh=SpreadsheetApp.getActive().getSheetByName('STORE_METADATA');
  const existing=new Set(readObjects_('STORE_METADATA').map(r=>String(r['Branch Code'])));
  readObjects_('BRANCHES').forEach(r=>{
    const code=String(r['Branch Code']||'').trim();
    if(code&&!existing.has(code)) sh.appendRow([code,String(r['Branch Name']||''),'']);
  });
}

function ensureStoreMetadata_(branchCode, branchName) {
  const sh=SpreadsheetApp.getActive().getSheetByName('STORE_METADATA');
  const rows=readObjects_('STORE_METADATA');
  const found=rows.find(r=>String(r['Branch Code'])===String(branchCode));
  if(!found) sh.appendRow([String(branchCode),String(branchName||''),'']);
  else if(!String(found['Store Name']||'').trim()){
    const headers=getHeaders_('STORE_METADATA'), row=rows.findIndex(r=>String(r['Branch Code'])===String(branchCode))+2;
    sh.getRange(row,headers.indexOf('Store Name')+1).setValue(String(branchName||''));
  }
}

function seedDefaultAreaManager_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('USERS');
  const values = sh.getDataRange().getValues();
  const exists = values.slice(1).some(r => String(r[1]).trim().toLowerCase() === 'area manager');
  if (!exists) sh.appendRow([Utilities.getUuid(), 'area manager', hash_('2026'), 'AREA_MANAGER', 'ALL', 'TRUE']);
}

function migrateLegacyData_() {
  const ss=SpreadsheetApp.getActive();
  const branchRows=readObjects_('BRANCHES');
  const branchByCode=new Map(branchRows.map(r=>[String(r['Branch Code']),r]));
  const agentSheet=ss.getSheetByName('AGENT_RPM');
  if (agentSheet && agentSheet.getLastRow()===1 && ss.getSheetByName('RPM_DATA')) {
    const legacy=readObjects_('RPM_DATA');
    if(legacy.length){
      const headers=getHeaders_('AGENT_RPM');
      const rows=legacy.map(r=>{
        const b=branchByCode.get(String(r['Branch Code']))||{};
        const target=Number(r.Target),actual=Number(r.Actual);
        const obj={'Record ID':r['Record ID']||Utilities.getUuid(),'Branch Code':r['Branch Code'],
          'Store Name':b['Branch Name']||'','Store ID':getBranchMeta_(r['Branch Code']).storeId, 'Agent Name':r['Agent Name']||'',SID:r.SID||'',
          Month:r.Month||'',Pillar:r.Pillar||'',Actual:r.Actual||'',Target:r.Target||'',
          'Achievement %':target>0?round_(actual/target*100,1):'',Notes:r.Notes||''};
        return headers.map(h=>obj[h]===undefined?'':obj[h]);
      });
      agentSheet.getRange(2,1,rows.length,headers.length).setValues(rows);
    }
  }
  const tnpsSheet=ss.getSheetByName('TNPS_AGENTS');
  if(tnpsSheet && tnpsSheet.getLastRow()===1 && ss.getSheetByName('TNPS_DATA')){
    const legacy=readObjects_('TNPS_DATA');
    if(legacy.length){
      const headers=getHeaders_('TNPS_AGENTS');
      const agentRows=readObjects_('AGENT_RPM');
      const rows=legacy.map(r=>{
        const b=branchByCode.get(String(r['Branch Code']))||{};
        const a=agentRows.find(x=>String(x['Branch Code'])===String(r['Branch Code'])&&String(x['Agent Name'])===String(r['Agent Name']))||{};
        const obj={'Record ID':r['Record ID']||Utilities.getUuid(),'Branch Code':r['Branch Code'],'Store Name':b['Branch Name']||'',
          'Store ID':getBranchMeta_(r['Branch Code']).storeId,'Agent Name':r['Agent Name']||'',SID:a.SID||'',Month:r.Month||'',Score:r.Score||'',BM:r.BM||'',
          'Achievement %':r['Achievement %']||'',Notes:r.Notes||''};
        return headers.map(h=>obj[h]===undefined?'':obj[h]);
      });
      tnpsSheet.getRange(2,1,rows.length,headers.length).setValues(rows);
    }
  }
}

function seedTargets_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('TARGETS');
  if (sh.getLastRow() > 1) return;
  const rows = APP.PILLARS.map(p => [Utilities.getUuid(), p, '', '%', 'TRUE']);
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

/** Add an Area Manager account from the Apps Script editor. Never store plain passwords. */
function createAreaManager(username, password, area) {
  if (!username || !password || String(password).length < 12) {
    throw new Error('Provide username and a password of at least 12 characters.');
  }
  const areaScope = String(area || 'ALL').trim() || 'ALL';
  const sh = SpreadsheetApp.getActive().getSheetByName('USERS');
  const values = sh.getDataRange().getValues();
  if (values.slice(1).some(r => String(r[1]).toLowerCase() === String(username).toLowerCase())) {
    throw new Error('Username already exists.');
  }
  sh.appendRow([Utilities.getUuid(), String(username).trim(), hash_(password), 'AREA_MANAGER', areaScope, 'TRUE']);
  return 'Area Manager account created.';
}

function getActiveBranchNames() {
  const sh = SpreadsheetApp.getActive().getSheetByName('BRANCHES');
  if (!sh || sh.getLastRow() < 2) return [];
  const rows = readObjects_('BRANCHES');
  return rows.filter(r => String(r['Branch Name'] || '').trim())
    .map(r => String(r['Branch Name']).trim());
}

/**
 * Branch code is fixed and known to the branch manager. On first successful
 * registration, if the Branch Code cell is blank, the submitted fixed code is
 * written once to BRANCHES. Later logins must match that saved value.
 */
function loginBranch(branchName, branchCode) {
  const name = String(branchName || '').trim();
  const code = String(branchCode || '').trim();
  if (!name || !code) throw new Error('Select a branch and enter its branch code.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName('BRANCHES');
    const values = sh.getDataRange().getValues();
    const headers = values[0].map(String);
    const col = h => headers.indexOf(h);
    const nameCol = col('Branch Name'), codeCol = col('Branch Code');
    const managerCol = col('Manager Name'), areaCol = col('Area');
    const rowIndex = values.findIndex((r, i) => i > 0 && String(r[nameCol]).trim().toLowerCase() === name.toLowerCase());
    if (rowIndex < 1) throw new Error('Branch not found.');
    const row = values[rowIndex];
    const savedCode = String(row[codeCol] || '').trim();
    if (!savedCode) {
      const duplicate = values.some((r, i) => i > 0 && i !== rowIndex && String(r[codeCol] || '').trim() === code);
      if (duplicate) throw new Error('This branch code is already assigned to another branch.');
      // First login claims the branch's pre-issued fixed code and persists it once.
      sh.getRange(rowIndex + 1, codeCol + 1).setNumberFormat('@').setValue(code);
      audit_({username: String(row[managerCol] || name), role:'STORE_MANAGER', branchCode:code}, 'BRANCH_CODE_REGISTERED', 'BRANCHES', '', 'Fixed branch code stored on first login');
    } else if (savedCode !== code) {
      Utilities.sleep(450);
      throw new Error('Incorrect branch code.');
    }
    ensureStoreMetadata_(code, String(row[nameCol]));
    const branchMeta = getBranchMeta_(code);
    const user = {
      username: String(row[managerCol] || name), role: 'STORE_MANAGER',
      branchCode: code, branchName: String(row[nameCol]),
      storeId: branchMeta.storeId, area: String(row[areaCol] || '')
    };
    return createSession_(user);
  } finally { lock.releaseLock(); }
}

function loginAreaManager(username, password) {
  if (!username || !password) throw new Error('Enter username and password.');
  const sh = SpreadsheetApp.getActive().getSheetByName('USERS');
  const rows = sh.getDataRange().getValues();
  const match = rows.slice(1).find(r =>
    String(r[1]).toLowerCase() === String(username).trim().toLowerCase() &&
    r[2] === hash_(password) &&
    String(r[3]) === 'AREA_MANAGER' &&
    String(r[5]).toUpperCase() === 'TRUE'
  );
  if (!match) {
    Utilities.sleep(500);
    throw new Error('Invalid username or password.');
  }
  return createSession_({
    username: String(match[1]),
    role: 'AREA_MANAGER',
    area: String(match[4] || ''),
    branchCode: '',
    branchName: ''
  });
}

function createSession_(user) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('sess_' + token, JSON.stringify(user), APP.SESSION_TTL_SECONDS);
  audit_(user, 'LOGIN', '', '', 'Successful login');
  return { token, user, expiresIn: APP.SESSION_TTL_SECONDS };
}

function logout(token) {
  const user = getSession_(token);
  CacheService.getScriptCache().remove('sess_' + token);
  audit_(user, 'LOGOUT', '', '', 'User logged out');
  return { ok: true };
}

function getSession_(token) {
  if (!token) throw new Error('Session expired. Please sign in again.');
  const raw = CacheService.getScriptCache().get('sess_' + token);
  if (!raw) throw new Error('Session expired. Please sign in again.');
  return JSON.parse(raw);
}

function getBootstrap(token) {
  const user = getSession_(token);
  return {
    user,
    navigation: [
      ['Dashboard', 'DASHBOARD'],
      ['Store RPM', 'STORE_RPM'],
      ['Agent RPM', 'AGENT_RPM'],
      ['Store KPIs', 'STORE_KPIS'],
      ['Agents KPIs', 'AGENT_KPIS'],
      ['TNPS Store', 'TNPS_STORE'],
      ['TNPS Agents', 'TNPS_AGENTS'],
      ['Final Complaints', 'COMPLAINTS'],
      ['Store Schedule', 'SCHEDULES'],
      ['Schedule Exceptions', 'SCHEDULE_EXCEPTIONS'],
      ['Store Tasks', 'STORE_TASKS'],
      ['HR Actions', 'HR_ACTIONS'],
      ['Late Opening', 'LATE_OPENING'],
      ['Short & Over Cases', 'SHORT_OVER'],
      ['Action Plans', 'ACTION_PLANS'],
      ['Reports', 'REPORTS']
    ],
    canEdit: user.role === 'STORE_MANAGER',
    store: { name: user.branchName || '', id: user.storeId || '' },
    authorizedBranches: getAuthorizedBranches_(user).map(b => ({ code: b.code, name: b.name }))
  };
}

function getDashboard(token, filters) {
  const user = getSession_(token);
  const branches = getFilteredAuthorizedBranches_(user, filters || {});
  const branchCodes = branches.map(b => b.code);
  const storeRpm = filterRowsByDate_(readObjects_('STORE_RPM').filter(r => branchCodes.includes(String(r['Branch Code']))), filters || {});
  const agentRpm = filterRowsByDate_(readObjects_('AGENT_RPM').filter(r => branchCodes.includes(String(r['Branch Code']))), filters || {});
  const complaints = filterRowsByDate_(readObjects_('COMPLAINTS').filter(r => branchCodes.includes(String(r['Branch Code']))), filters || {});
  const agents = [...new Set(agentRpm.map(r => r['Agent Name']).filter(Boolean))];
  const byPillar = APP.PILLARS.map(p => {
    const rows = storeRpm.filter(r => r.Pillar === p && isInFinancialYear_(r.Month));
    const avg = monthlyAverageAchievement_(rows);
    return { pillar: p, achievement: round_(avg, 1), passed: rows.length > 0 && avg >= 100 };
  });
  const passedCount = byPillar.filter(p => p.passed).length;
  const overall = byPillar.length ? byPillar.reduce((s, p) => s + p.achievement, 0) / byPillar.length : 0;
  const weakest = byPillar.slice().sort((a, b) => a.achievement - b.achievement)[0];
  return {
    branchCount: branches.length,
    agentCount: agents.length,
    passedCount,
    pillarCount: APP.PILLARS.length,
    overall: round_(overall, 1),
    openComplaints: complaints.filter(c => !['CLOSED', 'RESOLVED'].includes(String(c.Status).toUpperCase())).length,
    weakest,
    pillars: byPillar,
    agents: buildAgentSummary_(agentRpm),
    branchNames: branches.map(b => b.name)
  };
}

function monthlyAverageAchievement_(rows) {
  const byMonth = new Map();
  rows.forEach(r => {
    const target=Number(r.Target), actual=Number(r.Actual), month=String(r.Month || '').slice(0,7);
    if (!(target>0) || !month) return;
    if (!byMonth.has(month)) byMonth.set(month,[]);
    byMonth.get(month).push(actual/target*100);
  });
  const monthly=[...byMonth.values()].map(values=>values.reduce((a,b)=>a+b,0)/values.length).filter(Number.isFinite);
  return monthly.length ? round_(monthly.reduce((a,b)=>a+b,0)/monthly.length,1) : 0;
}

function buildAgentSummary_(rpm) {
  const names = [...new Set(rpm.map(r => String(r['Agent Name'] || '')).filter(Boolean))];
  return names.map(name => {
    const rows = rpm.filter(r => String(r['Agent Name']) === name);
    const scores = APP.PILLARS.map(p => {
      const pr = rows.filter(r => r.Pillar === p);
      const vals = pr.map(r => Number(r.Target) > 0 ? Number(r.Actual) / Number(r.Target) * 100 : null)
        .filter(v => v !== null && isFinite(v));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    return {
      name,
      sid: rows.find(r => r.SID)?.SID || '',
      passed: scores.filter(v => v !== null && v >= 100).length,
      overall: scores.filter(v => v !== null).length
        ? round_(scores.filter(v => v !== null).reduce((a, b) => a + b, 0) / scores.filter(v => v !== null).length, 1) : 0
    };
  }).sort((a, b) => b.passed - a.passed || b.overall - a.overall).slice(0, 10);
}

function getTable(token, sheetName, filters) {
  const user = getSession_(token);
  assertAllowedSheet_(sheetName);
  const safeFilters = filters || {};
  const rows = filterRowsByDate_(filterByScope_(readObjects_(sheetName), user)
    .filter(r => !safeFilters.branchCode || String(r['Branch Code']) === String(safeFilters.branchCode)), safeFilters);
  if (safeFilters.branchCode && !getAuthorizedBranches_(user).some(b => String(b.code) === String(safeFilters.branchCode))) {
    throw new Error('Selected branch is outside your authorized scope.');
  }
  const headers = getHeaders_(sheetName);
  const store = user.role === 'STORE_MANAGER' ? getBranchMeta_(user.branchCode) : (safeFilters.branchCode ? getBranchMeta_(safeFilters.branchCode) : null);
  const branchMeta = new Map();
  if (user.role === 'AREA_MANAGER') getAuthorizedBranches_(user).forEach(b=>branchMeta.set(String(b.code),getBranchMeta_(b.code)));
  const output = rows.map(r => {
    const copy = Object.assign({}, r);
    delete copy['Record ID'];
    // Identity columns are authoritative and always sourced from BRANCHES.
    const meta = store || branchMeta.get(String(r['Branch Code']));
    if (meta && headers.includes('Store Name')) copy['Store Name'] = meta.name;
    if (meta && headers.includes('Store ID')) copy['Store ID'] = meta.storeId;
    return copy;
  });
  return { sheetName, headers: headers.filter(h => h !== 'Record ID' && h !== 'Branch Code'), rows: output,
    ids: rows.map(r => r['Record ID']), canEdit: user.role === 'STORE_MANAGER', store,
    filters: { branchCode: safeFilters.branchCode || '', fromDate: safeFilters.fromDate || '', toDate: safeFilters.toDate || '' } };
}

function getFilteredAuthorizedBranches_(user, filters) {
  const branches = getAuthorizedBranches_(user);
  const selected = String(filters && filters.branchCode || '').trim();
  if (!selected) return branches;
  const match = branches.filter(b => String(b.code) === selected);
  if (!match.length) throw new Error('Selected branch is outside your authorized scope.');
  return match;
}

function filterRowsByDate_(rows, filters) {
  const from = String(filters && filters.fromDate || '').trim();
  const to = String(filters && filters.toDate || '').trim();
  if (!from && !to) return rows;
  const valid = v => /^\d{4}-\d{2}-\d{2}$/.test(v);
  if ((from && !valid(from)) || (to && !valid(to)) || (from && to && from > to)) throw new Error('Invalid date range.');
  return rows.filter(row => {
    const start = normalizeFilterDate_(row['Start Date'], 'Start Date');
    const end = normalizeFilterDate_(row['Due Date'], 'Due Date');
    if (start || end) {
      const recordStart = start || end, recordEnd = end || start;
      return (!to || recordStart <= to) && (!from || recordEnd >= from);
    }
    const month = String(row.Month || '').trim();
    const monthMatch = month.match(/^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?$/);
    if (monthMatch) {
      const monthStart = monthMatch[1] + '-' + monthMatch[2] + '-01';
      const monthEnd = Utilities.formatDate(new Date(Number(monthMatch[1]), Number(monthMatch[2]), 0), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      return (!to || monthStart <= to) && (!from || monthEnd >= from);
    }
    const candidates = ['Date', 'Created At']
      .map(key => normalizeFilterDate_(row[key], key)).filter(Boolean);
    if (!candidates.length) return false;
    return candidates.some(date => (!from || date >= from) && (!to || date <= to));
  });
}

function normalizeFilterDate_(value, fieldName) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw + '-01';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (!isNaN(d.getTime()) && fieldName === 'Created At') return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return '';
}

function getBranchMeta_(branchCode) {
  const row = readObjects_('BRANCHES').find(r => String(r['Branch Code']) === String(branchCode));
  if (!row) throw new Error('Branch context not found.');
  const metadata = readObjects_('STORE_METADATA').find(r => String(r['Branch Code']) === String(branchCode));
  return { name: String(row['Branch Name'] || ''), storeId: String(metadata ? metadata['Store ID'] || '' : ''), code: String(branchCode) };
}

function getScheduleMonth(token, monthKey, requestedBranchCode) {
  const user = getSession_(token);
  const key = String(monthKey || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) throw new Error('Invalid schedule month.');
  const parts = key.split('-').map(Number), year = parts[0], month = parts[1];
  if (year < 2026 || year > 2027 || (year === 2026 && month < 4) || (year === 2027 && month > 3)) throw new Error('Month must be within April 2026 – March 2027.');
  const authorizedBranches = getAuthorizedBranches_(user);
  const selectedCode = user.role === 'STORE_MANAGER' ? user.branchCode : String(requestedBranchCode || (authorizedBranches[0] && authorizedBranches[0].code) || '');
  if (!authorizedBranches.some(b => String(b.code) === selectedCode)) throw new Error('Branch is outside your authorized scope.');
  const store = getBranchMeta_(selectedCode);
  const branchCodes = [selectedCode];
  const rpmRows = readObjects_('AGENT_RPM').filter(r => branchCodes.includes(String(r['Branch Code'])));
  const agentMap = new Map();
  rpmRows.forEach(r => {
    const sid = String(r.SID || '').trim(), name = String(r['Agent Name'] || '').trim();
    if (sid || name) agentMap.set(sid || name, { sid, name });
  });
  const allBranchSchedules=readObjects_('SCHEDULES').filter(r=>branchCodes.includes(String(r['Branch Code'])));
  allBranchSchedules.forEach(r=>{const sid=String(r.SID||'').trim(),name=String(r['Agent Name']||'').trim();if(sid||name)agentMap.set(sid||name,{sid,name});});
  const scheduleRows = allBranchSchedules.filter(r => String(r.Date || '').slice(0,7) === key);
  const days = new Date(year, month, 0).getDate();
  const dayRows = Array.from({length:days}, (_,i) => {
    const date = year + '-' + String(month).padStart(2,'0') + '-' + String(i+1).padStart(2,'0');
    const shifts = {};
    scheduleRows.filter(r => String(r.Date).slice(0,10) === date).forEach(r => {
      const k = String(r.SID || r['Agent Name'] || '');
      shifts[k] = String(r.Shift || '');
    });
    return { date, shifts };
  });
  return { month:key, days:dayRows, agents:[...agentMap.values()].sort((a,b)=>(a.sid||a.name).localeCompare(b.sid||b.name)),
    canEdit:user.role==='STORE_MANAGER', store,
    selectedBranchCode:selectedCode,
    branches:user.role==='AREA_MANAGER' ? authorizedBranches : [] };
}

function saveScheduleGrid(token, monthKey, entries) {
  const user = getSession_(token); requireStoreManager_(user);
  const key = String(monthKey || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key) || !Array.isArray(entries) || entries.length > 1500) throw new Error('Invalid schedule upload.');
  const valid = ['', 'AM', 'PM', 'SUP AM', 'SUP PM', 'FULL', 'OFF'];
  entries.forEach(e => {
    const date=String(e.date||'').slice(0,10), shift=String(e.shift||'').trim().toUpperCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.slice(0,7)!==key || !valid.includes(shift)) throw new Error('Invalid date or shift in uploaded schedule.');
  });
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const store = getBranchMeta_(user.branchCode), sh = SpreadsheetApp.getActive().getSheetByName('SCHEDULES');
    const headers = getHeaders_('SCHEDULES'), values = sh.getDataRange().getValues(), index = Object.fromEntries(headers.map((h,i)=>[h,i]));
    const rowByKey = new Map();
    for (let i=1;i<values.length;i++) if (String(values[i][index['Branch Code']])===user.branchCode) {
      rowByKey.set(String(values[i][index.Date]).slice(0,10)+'|'+String(values[i][index.SID]||values[i][index['Agent Name']]||''),i);
    }
    const updates = new Map(), additions = [];
    entries.forEach(e => {
      const date=String(e.date).slice(0,10), sid=String(e.sid||''), shift=String(e.shift||'').trim().toUpperCase();
      const mapKey=date+'|'+(sid||String(e.agentName||'')), rowIndex=rowByKey.get(mapKey);
      if (!shift) { if(rowIndex!==undefined) updates.set(rowIndex,null); return; }
      const obj={'Record ID':rowIndex===undefined?Utilities.getUuid():values[rowIndex][index['Record ID']], 'Branch Code':user.branchCode,
        'Store Name':store.name,'Store ID':store.storeId,Date:date,'Agent Name':String(e.agentName||''),SID:sid,Shift:shift,Notes:''};
      const row=headers.map(h=>obj[h]===undefined?'':obj[h]);
      if(rowIndex===undefined) additions.push(row); else updates.set(rowIndex,row);
    });
    const orderedUpdates=[...updates.entries()].sort((a,b)=>a[0]-b[0]);
    let groupStart=-1, groupRows=[];
    const flushGroup=()=>{ if(groupRows.length){ sh.getRange(groupStart+1,1,groupRows.length,headers.length).setValues(groupRows); groupRows=[]; groupStart=-1; } };
    orderedUpdates.forEach(([rowIndex,row])=>{
      if(groupStart<0){groupStart=rowIndex;groupRows=[row||headers.map(()=> '')];}
      else if(rowIndex===groupStart+groupRows.length){groupRows.push(row||headers.map(()=> ''));}
      else{flushGroup();groupStart=rowIndex;groupRows=[row||headers.map(()=> '')];}
    });
    flushGroup();
    if(additions.length) sh.getRange(sh.getLastRow()+1,1,additions.length,headers.length).setValues(additions);
    audit_(user,'IMPORT_SCHEDULE','SCHEDULES','',entries.length+' schedule cells processed');
    return {ok:true,count:entries.length};
  } finally { lock.releaseLock(); }
}

function saveScheduleCell(token, monthKey, date, agentName, sid, shift) {
  const user = getSession_(token);
  requireStoreManager_(user);
  const allowed = ['', 'AM', 'PM', 'SUP AM', 'SUP PM', 'FULL', 'OFF'];
  const value = String(shift || '').trim().toUpperCase();
  if (!allowed.includes(value)) throw new Error('Invalid shift value.');
  const dateText = String(date || '').slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || dateText.slice(0,7) !== String(monthKey)) throw new Error('Invalid schedule date.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName('SCHEDULES');
    const rows = readObjects_('SCHEDULES');
    const found = rows.find(r => String(r['Branch Code'])===user.branchCode && String(r.Date).slice(0,10)===dateText && String(r.SID||r['Agent Name']||'')===String(sid||agentName||''));
    if (!value) {
      if (found) deleteRecordById_('SCHEDULES', found['Record ID']);
      audit_(user,'CLEAR_SHIFT','SCHEDULES',found ? found['Record ID'] : '',dateText+' '+sid);
      return {ok:true};
    }
    const store = getBranchMeta_(user.branchCode);
    const payload = {'Branch Code':user.branchCode,'Store Name':store.name,'Store ID':store.storeId,
      Date:dateText,'Agent Name':String(agentName||''),'SID':String(sid||''),Shift:value,Notes:''};
    if (found) return updateRecordInternal_('SCHEDULES',found['Record ID'],payload,user);
    return insertRecordInternal_('SCHEDULES',payload,user);
  } finally { lock.releaseLock(); }
}

function insertRecordInternal_(sheetName,payload,user) {
  const sh=SpreadsheetApp.getActive().getSheetByName(sheetName), headers=getHeaders_(sheetName), store=getBranchMeta_(user.branchCode);
  const row=headers.map(h=>h==='Record ID'?Utilities.getUuid():h==='Branch Code'?user.branchCode:h==='Store Name'?store.name:h==='Store ID'?store.storeId:h==='Created At'?new Date():sanitize_(payload[h] == null ? '' : payload[h]));
  sh.appendRow(row); audit_(user,'CREATE',sheetName,row[headers.indexOf('Record ID')],JSON.stringify(payload).slice(0,1000));
  return {ok:true,id:row[headers.indexOf('Record ID')]};
}

function updateRecordInternal_(sheetName,recordId,payload,user) {
  const sh=SpreadsheetApp.getActive().getSheetByName(sheetName), headers=getHeaders_(sheetName), idCol=headers.indexOf('Record ID')+1, branchCol=headers.indexOf('Branch Code')+1;
  const ids=sh.getRange(2,idCol,Math.max(sh.getLastRow()-1,1),1).getValues().flat(), idx=ids.findIndex(v=>String(v)===String(recordId));
  if(idx<0) throw new Error('Schedule record not found.');
  const rowNum=idx+2;
  if(String(sh.getRange(rowNum,branchCol).getValue())!==user.branchCode) throw new Error('Cross-branch update blocked.');
  const store=getBranchMeta_(user.branchCode), old=sh.getRange(rowNum,1,1,headers.length).getValues()[0];
  const row=headers.map((h,i)=>h==='Record ID'?recordId:h==='Branch Code'?user.branchCode:h==='Store Name'?store.name:h==='Store ID'?store.storeId:Object.prototype.hasOwnProperty.call(payload,h)?sanitize_(payload[h]):old[i]);
  sh.getRange(rowNum,1,1,headers.length).setValues([row]); audit_(user,'UPDATE',sheetName,recordId,JSON.stringify(payload).slice(0,1000));
  return {ok:true,id:recordId};
}

function deleteRecordById_(sheetName,recordId) {
  const sh=SpreadsheetApp.getActive().getSheetByName(sheetName), headers=getHeaders_(sheetName), col=headers.indexOf('Record ID')+1;
  const ids=sh.getRange(2,col,Math.max(sh.getLastRow()-1,1),1).getValues().flat(), idx=ids.findIndex(v=>String(v)===String(recordId));
  if(idx>=0) sh.deleteRow(idx+2);
}

function saveRecord(token, sheetName, recordId, payload) {
  const user = getSession_(token);
  requireStoreManager_(user);
  assertAllowedSheet_(sheetName);
  if (!payload || typeof payload !== 'object') throw new Error('Invalid record.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
    const headers = getHeaders_(sheetName);
    const idCol = headers.indexOf('Record ID') + 1;
    const branchCol = headers.indexOf('Branch Code') + 1;
    let rowNum = 0;
    if (recordId) {
      const ids = sh.getRange(2, idCol, Math.max(sh.getLastRow() - 1, 1), 1).getValues().flat();
      const idx = ids.findIndex(v => String(v) === String(recordId));
      if (idx < 0) throw new Error('Record not found.');
      rowNum = idx + 2;
      if (branchCol && String(sh.getRange(rowNum, branchCol).getValue()) !== user.branchCode) {
        throw new Error('You cannot edit another branch.');
      }
    }
    const store = getBranchMeta_(user.branchCode);
    const oldRow = rowNum ? sh.getRange(rowNum, 1, 1, headers.length).getValues()[0] : [];
    const clean = headers.map((h, i) => {
      if (h === 'Record ID') return recordId || Utilities.getUuid();
      if (h === 'Branch Code') return user.branchCode;
      if (h === 'Store Name') return store.name;
      if (h === 'Store ID') return store.storeId;
      if (h === 'Created At') return recordId ? oldRow[i] : new Date();
      return Object.prototype.hasOwnProperty.call(payload, h) ? sanitize_(payload[h]) : (rowNum ? oldRow[i] : '');
    });
    if (rowNum) sh.getRange(rowNum, 1, 1, clean.length).setValues([clean]);
    else sh.appendRow(clean);
    audit_(user, recordId ? 'UPDATE' : 'CREATE', sheetName, clean[0], JSON.stringify(payload).slice(0, 1000));
    return { ok: true, id: clean[0] };
  } finally {
    lock.releaseLock();
  }
}

function deleteRecord(token, sheetName, recordId) {
  const user = getSession_(token);
  requireStoreManager_(user);
  assertAllowedSheet_(sheetName);
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const headers = getHeaders_(sheetName);
  const idCol = headers.indexOf('Record ID') + 1;
  const branchCol = headers.indexOf('Branch Code') + 1;
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol - 1]) === String(recordId)) {
      if (branchCol && String(values[i][branchCol - 1]) !== user.branchCode) throw new Error('You cannot delete another branch record.');
      sh.deleteRow(i + 1);
      audit_(user, 'DELETE', sheetName, recordId, 'Record deleted');
      return { ok: true };
    }
  }
  throw new Error('Record not found.');
}

function addCustomField(token, sheetName, fieldName) {
  const user = getSession_(token);
  requireStoreManager_(user);
  assertAllowedSheet_(sheetName);
  const name = String(fieldName || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9 _-]{1,39}$/.test(name)) throw new Error('Field name must be 2–40 characters and use English letters/numbers.');
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const headers = getHeaders_(sheetName);
  if (headers.includes(name)) throw new Error('This column already exists.');
  sh.getRange(1, sh.getLastColumn() + 1).setValue(name);
  SpreadsheetApp.getActive().getSheetByName('CUSTOM_FIELDS')
    .appendRow([Utilities.getUuid(), sheetName, name, user.username, new Date()]);
  audit_(user, 'ADD_COLUMN', sheetName, '', name);
  return { ok: true };
}

function removeCustomField(token, sheetName, fieldName) {
  const user = getSession_(token);
  requireStoreManager_(user);
  assertAllowedSheet_(sheetName);
  const protectedHeaders = APP.SHEETS[sheetName];
  if (protectedHeaders.includes(fieldName) || fieldName === 'Record ID') throw new Error('System columns cannot be removed.');
  const custom = SpreadsheetApp.getActive().getSheetByName('CUSTOM_FIELDS');
  const rows = custom.getDataRange().getValues();
  const allowed = rows.slice(1).some(r => r[1] === sheetName && r[2] === fieldName);
  if (!allowed) throw new Error('Only custom columns can be removed.');
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const col = getHeaders_(sheetName).indexOf(fieldName) + 1;
  if (col < 1) throw new Error('Column not found.');
  sh.deleteColumn(col);
  for (let i = rows.length - 1; i >= 1; i--) if (rows[i][1] === sheetName && rows[i][2] === fieldName) custom.deleteRow(i + 1);
  audit_(user, 'DELETE_COLUMN', sheetName, '', fieldName);
  return { ok: true };
}

function importRows(token, sheetName, records) {
  const user = getSession_(token);
  requireStoreManager_(user);
  assertAllowedSheet_(sheetName);
  if (!Array.isArray(records) || records.length > 2000) throw new Error('Upload must contain at most 2,000 rows.');
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const headers = getHeaders_(sheetName);
  const store = getBranchMeta_(user.branchCode);
  const rows = records.map(obj => headers.map(h => {
    if (h === 'Record ID') return Utilities.getUuid();
    if (h === 'Branch Code') return user.branchCode;
    if (h === 'Store Name') return store.name;
    if (h === 'Store ID') return store.storeId;
    return sanitize_(obj[h] == null ? '' : obj[h]);
  }));
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  audit_(user, 'IMPORT', sheetName, '', rows.length + ' rows imported');
  return { ok: true, count: rows.length };
}

function getAuthorizedBranches_(user) {
  const rows = readObjects_('BRANCHES').filter(r => String(r['Branch Name'] || '').trim() && String(r['Branch Code'] || '').trim());
  if (user.role === 'STORE_MANAGER') {
    return rows.filter(r => String(r['Branch Code']) === user.branchCode).map(r => ({
      code: String(r['Branch Code']), name: String(r['Branch Name']), area: String(r.Area)
    }));
  }
  return rows.filter(r => user.area === 'ALL' || String(r.Area) === user.area).map(r => ({
    code: String(r['Branch Code']), name: String(r['Branch Name']), area: String(r.Area)
  }));
}

function filterByScope_(rows, user) {
  if (user.role === 'STORE_MANAGER') {
    return rows.filter(r => String(r['Branch Code'] || '') === user.branchCode);
  }
  const codes = getAuthorizedBranches_(user).map(b => b.code);
  return rows.filter(r => codes.includes(String(r['Branch Code'] || '')));
}

function assertAllowedSheet_(name) {
  const allowed = ['STORE_RPM','AGENT_RPM','TNPS_STORE','TNPS_AGENTS','COMPLAINTS','SCHEDULES','SCHEDULE_EXCEPTIONS','STORE_TASKS','STORE_KPIS','AGENT_KPIS','HR_ACTIONS','LATE_OPENING','SHORT_OVER','ACTION_PLANS'];
  if (!allowed.includes(name)) throw new Error('This data table is not available through the application.');
}

function requireStoreManager_(user) {
  if (user.role !== 'STORE_MANAGER') throw new Error('Read-only access. Store Manager permission is required.');
}

function readObjects_(sheetName) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(v => v !== '')).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] instanceof Date ? Utilities.formatDate(row[i], Session.getScriptTimeZone(), 'yyyy-MM-dd') : row[i]);
    return obj;
  });
}

function getHeaders_(sheetName) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh || sh.getLastColumn() < 1) throw new Error('Sheet not initialized: ' + sheetName);
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

function isInFinancialYear_(monthValue) {
  const d = monthValue instanceof Date ? monthValue : new Date(String(monthValue));
  if (isNaN(d.getTime())) return false;
  const start = new Date(2026, 3, 1);
  const end = new Date(2027, 2, 31, 23, 59, 59);
  return d >= start && d <= end;
}

function hash_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}

function sanitize_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.length > 5000) throw new Error('Field value is too long.');
    return s;
  }
  return value;
}

function round_(n, digits) {
  const m = Math.pow(10, digits);
  return Math.round(Number(n) * m) / m;
}

function audit_(user, action, sheetName, recordId, details) {
  const sh = SpreadsheetApp.getActive().getSheetByName('AUDIT_LOG');
  if (!sh) return;
  sh.appendRow([new Date(), user.username, user.role, user.branchCode || '', action, sheetName, recordId, String(details || '').slice(0, 1000)]);
}
