const REVIEW_STATUS_VALUES = new Set([
  'draft',
  'needs-review',
  'approved',
  'rejected',
  'superseded',
]);

export const REVIEW_STATUSES = Object.freeze([...REVIEW_STATUS_VALUES]);

function clonePlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return { ...value };
}

export function normaliseReviewStatus(value, fallback = 'needs-review') {
  if (REVIEW_STATUS_VALUES.has(value)) {
    return value;
  }

  if (REVIEW_STATUS_VALUES.has(fallback)) {
    return fallback;
  }

  return 'needs-review';
}

export function normaliseReviewText(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [];
}

function normaliseStateReview(stateId, stateReview = {}, groupReview = {}) {
  const review = clonePlainObject(stateReview);

  return {
    id: stateId,
    title: review.title || stateId,
    acceptanceCriteria: normaliseReviewText(review.acceptanceCriteria),
    acceptanceStatus: normaliseReviewStatus(
      review.acceptanceStatus || review.gherkinStatus,
      groupReview.acceptanceStatus,
    ),
    designRiskNotes: normaliseReviewText(review.designRiskNotes),
    designRiskStatus: normaliseReviewStatus(
      review.designRiskStatus,
      groupReview.designRiskStatus,
    ),
  };
}

function normaliseGroupReview(groupId, groupReview = {}) {
  const review = clonePlainObject(groupReview);
  const states = clonePlainObject(review.states);
  const acceptanceStatus = normaliseReviewStatus(
    review.acceptanceStatus || review.gherkinStatus,
  );
  const designRiskStatus = normaliseReviewStatus(review.designRiskStatus);

  return {
    id: groupId,
    title: review.title || groupId,
    acceptanceCriteria: normaliseReviewText(review.acceptanceCriteria),
    acceptanceStatus,
    designRiskNotes: normaliseReviewText(review.designRiskNotes),
    designRiskStatus,
    states: Object.fromEntries(
      Object.entries(states).map(([stateId, stateReview]) => [
        stateId,
        normaliseStateReview(stateId, stateReview, {
          acceptanceStatus,
          designRiskStatus,
        }),
      ]),
    ),
  };
}

function mergeReviewText(baseValue, overrideValue) {
  const overrideText = normaliseReviewText(overrideValue);

  if (overrideText.length > 0) {
    return overrideText;
  }

  return normaliseReviewText(baseValue);
}

function mergeStateReview(baseState, overrideState = {}, groupReview = {}) {
  const base = normaliseStateReview(baseState.id, baseState, groupReview);
  const override = clonePlainObject(overrideState);

  return {
    ...base,
    title: override.title || base.title,
    acceptanceCriteria: mergeReviewText(
      base.acceptanceCriteria,
      override.acceptanceCriteria,
    ),
    acceptanceStatus: normaliseReviewStatus(
      override.acceptanceStatus || override.gherkinStatus,
      base.acceptanceStatus,
    ),
    designRiskNotes: mergeReviewText(
      base.designRiskNotes,
      override.designRiskNotes,
    ),
    designRiskStatus: normaliseReviewStatus(
      override.designRiskStatus,
      base.designRiskStatus,
    ),
  };
}

function mergeGroupReview(baseGroup, overrideGroup = {}) {
  const base = normaliseGroupReview(baseGroup.id, baseGroup);
  const override = clonePlainObject(overrideGroup);
  const overrideStates = clonePlainObject(override.states);
  const stateIds = new Set([
    ...Object.keys(base.states),
    ...Object.keys(overrideStates),
  ]);
  const acceptanceStatus = normaliseReviewStatus(
    override.acceptanceStatus || override.gherkinStatus,
    base.acceptanceStatus,
  );
  const designRiskStatus = normaliseReviewStatus(
    override.designRiskStatus,
    base.designRiskStatus,
  );

  const group = {
    ...base,
    title: override.title || base.title,
    acceptanceCriteria: mergeReviewText(
      base.acceptanceCriteria,
      override.acceptanceCriteria,
    ),
    acceptanceStatus,
    designRiskNotes: mergeReviewText(base.designRiskNotes, override.designRiskNotes),
    designRiskStatus,
    states: {},
  };

  for (const stateId of stateIds) {
    const baseState = base.states[stateId] || { id: stateId, title: stateId };

    group.states[stateId] = mergeStateReview(baseState, overrideStates[stateId], {
      acceptanceStatus,
      designRiskStatus,
    });
  }

  return group;
}

export function buildReportingReviewModel(baseReview = {}, overrides = {}) {
  const baseGroups = clonePlainObject(baseReview.groups || baseReview);
  const overrideGroups = clonePlainObject(overrides.groups || overrides);
  const groupIds = new Set([
    ...Object.keys(baseGroups),
    ...Object.keys(overrideGroups),
  ]);

  return {
    groups: Object.fromEntries(
      [...groupIds].map((groupId) => [
        groupId,
        mergeGroupReview(
          { id: groupId, ...clonePlainObject(baseGroups[groupId]) },
          overrideGroups[groupId],
        ),
      ]),
    ),
  };
}

function sameReviewText(left, right) {
  const leftText = normaliseReviewText(left).join('\n');
  const rightText = normaliseReviewText(right).join('\n');

  return leftText.length > 0 && leftText === rightText;
}

export function validateReportingReviewModel(model = {}) {
  const reviewModel = buildReportingReviewModel(model);
  const issues = [];

  for (const group of Object.values(reviewModel.groups)) {
    if (group.acceptanceCriteria.length === 0) {
      issues.push({
        code: 'missing-group-acceptance-criteria',
        groupId: group.id,
      });
    }

    if (group.designRiskNotes.length === 0) {
      issues.push({
        code: 'missing-group-design-risk-notes',
        groupId: group.id,
      });
    }

    for (const state of Object.values(group.states)) {
      if (sameReviewText(group.acceptanceCriteria, state.acceptanceCriteria)) {
        issues.push({
          code: 'duplicated-group-acceptance-criteria',
          groupId: group.id,
          stateId: state.id,
        });
      }

      if (sameReviewText(group.designRiskNotes, state.designRiskNotes)) {
        issues.push({
          code: 'duplicated-group-design-risk-notes',
          groupId: group.id,
          stateId: state.id,
        });
      }
    }
  }

  return issues;
}

export function summariseReportingReviewModel(model = {}) {
  const reviewModel = buildReportingReviewModel(model);
  const summary = {
    groups: 0,
    states: 0,
    statuses: Object.fromEntries(REVIEW_STATUSES.map((status) => [status, 0])),
  };

  for (const group of Object.values(reviewModel.groups)) {
    summary.groups += 1;
    summary.statuses[group.acceptanceStatus] += 1;
    summary.statuses[group.designRiskStatus] += 1;

    for (const state of Object.values(group.states)) {
      summary.states += 1;
      summary.statuses[state.acceptanceStatus] += 1;
      summary.statuses[state.designRiskStatus] += 1;
    }
  }

  return summary;
}
