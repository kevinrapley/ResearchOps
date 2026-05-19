import assert from 'node:assert/strict';

import { parseCsv } from '../infra/cloudflare/src/service/projects.js';

/*
 * RFC 4180-style CSV parser tests for parseCsv.
 *
 * The previous implementation split on every newline and then on every comma,
 * which broke any row containing a quoted cell with embedded commas, embedded
 * quotes or embedded newlines. data/projects.csv has all three (the
 * Stakeholders column is a JSON array; the Objectives column is multi-line),
 * so a single Airtable row was exploded into dozens of garbage records. See
 * docs/agent-audit/reasoning/2026/05/15/.
 */

function assertEqualRows(actual, expected, label) {
	assert.deepEqual(actual, expected, `parseCsv: ${label}`);
}

// 1. Empty / blank input returns an empty array.
assertEqualRows(parseCsv(''), [], 'empty input');
assertEqualRows(parseCsv('   \n\n'), [], 'whitespace-only input');

// 2. Header-only input returns no records.
assertEqualRows(parseCsv('a,b,c'), [], 'header-only input');

// 3. Plain rows without quotes parse field-by-field.
assertEqualRows(
	parseCsv('a,b\n1,2\n3,4\n'),
	[
		{ a: '1', b: '2' },
		{ a: '3', b: '4' },
	],
	'plain rows'
);

// 4. Trailing blank rows are skipped.
assertEqualRows(parseCsv('a,b\n1,2\n\n\n'), [{ a: '1', b: '2' }], 'trailing blank rows');

// 5. A quoted field may contain commas.
assertEqualRows(
	parseCsv('id,description\nrec1,"a, b, c"\n'),
	[{ id: 'rec1', description: 'a, b, c' }],
	'quoted commas'
);

// 6. Escaped double-quote "" inside a quoted field becomes a literal ".
assertEqualRows(
	parseCsv('id,note\nrec1,"she said ""hello"""\n'),
	[{ id: 'rec1', note: 'she said "hello"' }],
	'escaped double-quotes'
);

// 7. A quoted field may span multiple lines (newlines preserved).
assertEqualRows(
	parseCsv('id,objectives\nrec1,"one\ntwo\nthree"\n'),
	[{ id: 'rec1', objectives: 'one\ntwo\nthree' }],
	'multi-line cell'
);

// 8. CRLF line endings are accepted (and CRLF inside quotes survives).
assertEqualRows(
	parseCsv('id,note\r\nrec1,plain\r\n'),
	[{ id: 'rec1', note: 'plain' }],
	'CRLF rows'
);

// 9. UTF-8 BOM on the header is stripped.
assertEqualRows(
	parseCsv('﻿id,name\nrec1,Project\n'),
	[{ id: 'rec1', name: 'Project' }],
	'BOM stripped'
);

// 10. Quoted JSON value with embedded commas and "" escapes — the actual
//     shape that data/projects.csv emits for the Stakeholders column. The
//     output must round-trip through JSON.parse.
const stakeholdersCsv =
	'Record ID,Name,Stakeholders\n' +
	'recMtdmBbaFiIF2Tm,New Project,' +
	'"[{""name"":""Kevin Rapley"",""role"":""User Researcher"",""email"":""kevin.rapley@homeoffice.gov.uk""}]"\n';
const stakeholdersRows = parseCsv(stakeholdersCsv);
assert.equal(stakeholdersRows.length, 1, 'parseCsv: stakeholders row count');
assert.equal(
	stakeholdersRows[0]['Record ID'],
	'recMtdmBbaFiIF2Tm',
	'parseCsv: stakeholders record id'
);
assert.equal(stakeholdersRows[0].Name, 'New Project', 'parseCsv: stakeholders name');
const parsedStakeholders = JSON.parse(stakeholdersRows[0].Stakeholders);
assert.deepEqual(
	parsedStakeholders,
	[{ name: 'Kevin Rapley', role: 'User Researcher', email: 'kevin.rapley@homeoffice.gov.uk' }],
	'parseCsv: stakeholders JSON round-trip'
);

// 11. The full first row of data/projects.csv (Stakeholders + multi-line
//     Objectives) parses into one record, not many.
const fullRowCsv =
	'Record ID,Name,Org,Phase,Status,Description,Stakeholders,Objectives,UserGroups,CreatedAt\n' +
	'recMtdmBbaFiIF2Tm,New Project,Home Office Biometrics,Discovery,Planning research,' +
	'Project description of the new project,' +
	'"[{""name"":""Kevin Rapley"",""role"":""User Researcher"",""email"":""kevin.rapley@homeoffice.gov.uk""}]",' +
	'"Objective 1\nObjective 2",' +
	'Caseworkers,2026-05-01T10:00:00.000Z\n';
const fullRows = parseCsv(fullRowCsv);
assert.equal(fullRows.length, 1, 'parseCsv: full row count');
assert.equal(fullRows[0]['Record ID'], 'recMtdmBbaFiIF2Tm', 'parseCsv: full row record id');
assert.equal(
	fullRows[0].Objectives,
	'Objective 1\nObjective 2',
	'parseCsv: multi-line objectives preserved'
);
assert.equal(fullRows[0].UserGroups, 'Caseworkers', 'parseCsv: trailing simple column');

// 12. Two consecutive complex rows must each parse as one record.
const twoRowsCsv =
	'Record ID,Name,Stakeholders\n' +
	'recA,Alpha,"[{""name"":""Alex"",""role"":""Researcher""}]"\n' +
	'recB,Beta,"[{""name"":""Bea"",""role"":""Lead""},{""name"":""Cal"",""role"":""Observer""}]"\n';
const twoRows = parseCsv(twoRowsCsv);
assert.equal(twoRows.length, 2, 'parseCsv: two complex rows');
assert.equal(twoRows[0]['Record ID'], 'recA', 'parseCsv: first record id');
assert.equal(twoRows[1]['Record ID'], 'recB', 'parseCsv: second record id');
const beta = JSON.parse(twoRows[1].Stakeholders);
assert.equal(beta.length, 2, 'parseCsv: second row stakeholders length');
assert.equal(beta[1].name, 'Cal', 'parseCsv: second row stakeholders content');

console.log('parseCsv: all 12 assertions passed');
