import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildReportingReviewModel,
  normaliseReviewStatus,
  summariseReportingReviewModel,
  validateReportingReviewModel,
} from '../scripts/reporting-review-model.mjs';

test('buildReportingReviewModel keeps group criteria separate from state criteria', () => {
  const model = buildReportingReviewModel({
    groups: {
      start: {
        title: 'Start research project',
        acceptanceCriteria: [
          'As a user researcher, I can start a project using a guided process.',
        ],
        designRiskNotes: [
          'Project setup errors create downstream traceability risk.',
        ],
        states: {
          'step-1-filled': {
            acceptanceCriteria: [
              'I can see the project details I entered have been retained.',
            ],
            designRiskNotes: [
              'The completed first step must make progress visible.',
            ],
          },
        },
      },
    },
  });

  assert.deepEqual(model.groups.start.acceptanceCriteria, [
    'As a user researcher, I can start a project using a guided process.',
  ]);
  assert.deepEqual(model.groups.start.states['step-1-filled'].acceptanceCriteria, [
    'I can see the project details I entered have been retained.',
  ]);
  assert.equal(validateReportingReviewModel(model).length, 0);
});

test('buildReportingReviewModel applies repo-backed review overrides', () => {
  const model = buildReportingReviewModel(
    {
      groups: {
        analysis: {
          acceptanceStatus: 'needs-review',
          designRiskStatus: 'needs-review',
          acceptanceCriteria: ['Group-level analysis criteria.'],
          designRiskNotes: ['Group-level analysis risk.'],
          states: {
            'theme-created': {
              acceptanceCriteria: ['Original state criteria.'],
              designRiskNotes: ['Original state risk.'],
            },
          },
        },
      },
    },
    {
      groups: {
        analysis: {
          acceptanceStatus: 'approved',
          states: {
            'theme-created': {
              acceptanceStatus: 'approved',
              designRiskStatus: 'draft',
              acceptanceCriteria: ['Curated theme-created state criteria.'],
            },
          },
        },
      },
    },
  );

  assert.equal(model.groups.analysis.acceptanceStatus, 'approved');
  assert.equal(
    model.groups.analysis.states['theme-created'].acceptanceStatus,
    'approved',
  );
  assert.equal(
    model.groups.analysis.states['theme-created'].designRiskStatus,
    'draft',
  );
  assert.deepEqual(
    model.groups.analysis.states['theme-created'].acceptanceCriteria,
    ['Curated theme-created state criteria.'],
  );
  assert.deepEqual(model.groups.analysis.states['theme-created'].designRiskNotes, [
    'Original state risk.',
  ]);
});

test('validateReportingReviewModel flags duplicated group content at state level', () => {
  const issues = validateReportingReviewModel({
    groups: {
      consent: {
        acceptanceCriteria: ['Shared consent criteria.'],
        designRiskNotes: ['Shared consent risk.'],
        states: {
          default: {
            acceptanceCriteria: ['Shared consent criteria.'],
            designRiskNotes: ['Shared consent risk.'],
          },
        },
      },
    },
  });

  assert.deepEqual(
    issues.map((issue) => issue.code),
    [
      'duplicated-group-acceptance-criteria',
      'duplicated-group-design-risk-notes',
    ],
  );
});

test('review statuses are normalised and summarised', () => {
  assert.equal(normaliseReviewStatus('approved'), 'approved');
  assert.equal(normaliseReviewStatus('unknown'), 'needs-review');

  const summary = summariseReportingReviewModel({
    groups: {
      start: {
        acceptanceStatus: 'approved',
        designRiskStatus: 'needs-review',
        acceptanceCriteria: ['Group criteria.'],
        designRiskNotes: ['Group risk.'],
        states: {
          default: {
            acceptanceStatus: 'draft',
            designRiskStatus: 'superseded',
            acceptanceCriteria: ['State criteria.'],
            designRiskNotes: ['State risk.'],
          },
        },
      },
    },
  });

  assert.equal(summary.groups, 1);
  assert.equal(summary.states, 1);
  assert.equal(summary.statuses.approved, 1);
  assert.equal(summary.statuses['needs-review'], 1);
  assert.equal(summary.statuses.draft, 1);
  assert.equal(summary.statuses.superseded, 1);
});
