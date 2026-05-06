/* eslint-env node */

/**
 * @file scripts/reporting-review-evidence.mjs
 * @summary Explicit group and state evidence for the reporting-site walkthrough.
 */

function risk(text) {
	return {
		risk: text,
		impact: 'If this is accepted without review, ResearchOps traceability, accessibility or user confidence may be weakened.',
		recommendedChange: 'Review this evidence against ResearchOps intent, GOV.UK component conventions and WCAG 2.2 AA expectations.',
		owner: 'UCD team',
		status: 'Needs review',
	};
}

function state(title, gherkin, riskText) {
	return {
		title,
		acceptanceStatus: 'needs-review',
		designRiskStatus: 'needs-review',
		gherkin,
		designRisk: risk(riskText),
	};
}

const START_GROUP = `Feature: Start a new research project

  As a user researcher
  I want to define a project with clear context, objectives and ownership
  So that my team can start research work with shared intent and traceable setup information

  Scenario: Complete the guided project setup safely
    Then I should understand what project information is needed before I commit anything
    And Step 1 should ask only for the essential project name and description
    And the project should start with service phase "Discovery" and status "Goal setting & problem defining" by default
    And I should be able to review the full setup before creating the project

  Scenario: Understand the guided process
    Then I should be guided through project definition, research framing, ownership and check-your-answers steps`;

const CONSENT_GROUP = `Feature: Participant consent

  As a user researcher
  I want to review and record consent within the correct participant, study and consent-form context
  So that consent evidence is clear, current and auditable

  Scenario: Work within the correct consent context
    Then I should see the project, study, participant and consent-form context needed to trust the record
    And I should be blocked where required context is missing or incomplete`;

const ANALYSIS_GROUP = `Feature: Synthesize research evidence

  As a user researcher
  I want to group evidence and create traceable themes
  So that insights and recommendations remain connected to source evidence

  Scenario: Maintain traceability from evidence to theme
    Then I should be able to review evidence provenance before grouping it
    And created themes should remain connected to their source evidence

  Scenario: Prevent unsupported theme creation
    Then I should be prevented from creating a theme until evidence has been grouped`;

export const REPORTING_REVIEW_GROUPS = Object.freeze({
	start: {
		id: 'start',
		pageId: 'start',
		title: 'Start research project',
		acceptanceStatus: 'needs-review',
		designRiskStatus: 'needs-review',
		gherkin: START_GROUP,
		designRisk: risk('The start-project journey is the commitment point for the ResearchOps evidence model. Weak framing can make later work appear traceable when the project context is weak.'),
		states: {
			default: state('Default state', 'Feature: Start project default state\n\n  Scenario: Complete Step 1 controls\n    Then I should be able to enter the project name\n    And I should be able to enter the project description\n    And I should not be asked to select the service phase or project status in Step 1\n    And the project should use "Discovery" and "Goal setting & problem defining" as default values\n    And I should be able to continue without losing my answers', 'The first state must make the essential form controls clear and operable while avoiding unnecessary early classification choices.'),
			'step-1-filled': state('Step 1 completed with essential project definition', 'Feature: Step 1 completed\n\n  Scenario: Continue after defining essential project information\n    Then my project name and description should be retained\n    And the default service phase and project status should be retained for review\n    And I should be able to go back or correct editable answers without losing progress', 'A completed first step must show progress without implying that the project is fully governed.'),
			'step-2-default': state('Step 2 default state', 'Feature: Step 2 default state\n\n  Scenario: Provide research framing context\n    Then I should be able to enter stakeholders, objectives and user groups\n    And each field should explain the planning information expected', 'This state must ask for research framing in user-centred terms.'),
			'step-2-filled-no-ai': state('Step 2 completed with researcher-authored context', 'Feature: Step 2 completed with researcher-authored context\n\n  Scenario: Continue with researcher-authored wording\n    Then my wording should be retained\n    And the service should not imply that automated rewriting is required', 'Researcher-authored wording must remain a complete and trusted path.'),
			'step-2-ai-rewrite-shown': state('Step 2 assisted rewrite shown', 'Feature: Step 2 assisted rewrite shown\n\n  Scenario: Use assisted wording deliberately\n    Then assistance should only run after an explicit user action\n    And I should remain able to reject, amend or ignore suggested wording', 'Assisted wording creates provenance and accountability risk unless suggestions are optional and under user control.'),
			'step-3-default': state('Step 3 default state', 'Feature: Step 3 default state\n\n  Scenario: Add ownership and notes safely\n    Then I should be able to enter ownership and planning notes\n    And the service should not encourage unnecessary personal data capture', 'The notes step can become a privacy leakage point if broad free-text capture is not bounded.'),
			'step-3-filled': state('Step 3 completed before check answers', 'Feature: Step 3 completed before check answers\n\n  Scenario: Move toward review\n    Then my answers should remain available on the review step\n    And I should still be able to correct earlier answers', 'Correction routes must remain available until the project is created.'),
			'step-4-check-answers': state('Step 4 check answers before creating the project', 'Feature: Check answers before creating the project\n\n  Scenario: Review before committing\n    Then I should be able to identify and change inaccurate editable answers\n    And I should see the default service phase and project status before creating the project\n    And I should understand that creating the project commits the setup information', 'The check-answers state is the final safeguard against weak or incorrect project records.'),
		},
	},
	'participant-consent': {
		id: 'participant-consent',
		pageId: 'study-participant-consent',
		title: 'Participant consent',
		acceptanceStatus: 'needs-review',
		designRiskStatus: 'needs-review',
		gherkin: CONSENT_GROUP,
		designRisk: risk('Consent is a high-trust research governance activity. Ambiguity about participant, study or consent-form context creates evidence-integrity risk.'),
		states: {
			default: state('Consent workspace loaded', 'Feature: Consent workspace loaded\n\n  Scenario: Understand the available consent action\n    Then I should identify the study context and published consent form\n    And I should understand the next consent action needed', 'The loaded state must make the selected study context visible enough to prevent accidental misattribution.'),
			'missing-context-error': state('Missing study context error state', 'Feature: Missing study context error state\n\n  Scenario: Recover from missing consent route context\n    Then I should be told that participant consent cannot continue\n    And I should be given a recovery route rather than an empty consent screen', 'Missing context must be treated as a controlled error state.'),
			'no-published-consent-form': state('No published consent form state', 'Feature: No published consent form state\n\n  Scenario: Block consent capture until a form is published\n    Then I should understand that consent cannot be captured yet\n    And I should know that a consent form must be created or published first', 'Capturing consent without a published form would weaken provenance.'),
			'no-participants': state('No participants state', 'Feature: No participants state\n\n  Scenario: Block consent capture until participants exist\n    Then I should understand that consent cannot be captured yet\n    And this should not be confused with a loading failure', 'The state must distinguish no records from a technical loading problem.'),
			'participant-selected': state('Participant selected for consent review', 'Feature: Participant selected for consent review\n\n  Scenario: Review consent for the selected participant\n    Then I should see which participant is selected\n    And I should understand the consent options that apply to that participant and study', 'The selected-participant state carries misattribution risk.'),
		},
	},
	analysis: {
		id: 'analysis',
		pageId: 'synthesize',
		title: 'Study synthesis',
		acceptanceStatus: 'needs-review',
		designRiskStatus: 'needs-review',
		gherkin: ANALYSIS_GROUP,
		designRisk: risk('The analysis journey is central to ResearchOps traceability. Weak evidence-to-theme links can make recommendations appear stronger than the evidence supports.'),
		states: {
			'missing-sid-error': state('Missing study ID error state', 'Feature: Missing study ID error state\n\n  Scenario: Recover from missing study context\n    Then I should be told that synthesis cannot start\n    And I should be able to return to a valid study context', 'This should remain an explicit route-context error.'),
			'empty-evidence': state('Empty evidence state', 'Feature: Empty evidence state\n\n  Scenario: Understand that no evidence is available\n    Then I should understand that synthesis cannot proceed yet\n    And the page should not imply that analysis is complete', 'Absence of evidence must not be presented as an insight.'),
			'evidence-loaded': state('Evidence available before working clusters', 'Feature: Evidence available before working clusters\n\n  Scenario: Review evidence before clustering\n    Then I should review source evidence before grouping it\n    And I should have enough provenance context to make a defensible analytical decision', 'Available evidence should preserve provenance cues.'),
			'working-cluster-created': state('Working cluster grouping created', 'Feature: Working cluster grouping created\n\n  Scenario: Treat a working cluster as provisional\n    Then I should understand that the cluster is provisional\n    And it should not be presented with the same authority as a final insight', 'Working clusters must remain visibly provisional.'),
			'evidence-added-to-cluster': state('Evidence added to working cluster grouping', 'Feature: Evidence added to working cluster grouping\n\n  Scenario: Add evidence to a working cluster\n    Then I should see what evidence belongs to the cluster\n    And evidence movement should remain auditable', 'Evidence movement should be auditable.'),
			'theme-blocked-without-evidence': state('Theme creation hidden before evidence is grouped', 'Feature: Theme creation hidden before evidence is grouped\n\n  Scenario: Block theme creation without grouped evidence\n    Then theme creation should remain unavailable\n    And I should understand what evidence action is needed', 'Blocking unsupported theme creation is an evidence-integrity safeguard.'),
			'theme-created': state('Theme created with evidence traceability', 'Feature: Theme created with evidence traceability\n\n  Scenario: Review a created theme with traceability\n    Then the theme should remain connected to source evidence\n    And it should not appear stronger than the evidence behind it', 'Created themes must show enough provenance to stop themes becoming detached claims.'),
		},
	},
});

const GROUPS_BY_PAGE_ID = Object.freeze(Object.fromEntries(Object.values(REPORTING_REVIEW_GROUPS).map((group) => [group.pageId, group])));

export function reportingReviewGroupForPage(page = {}) {
	return GROUPS_BY_PAGE_ID[page.id] || null;
}

export function reportingReviewStateFor(page = {}, item = {}) {
	const group = reportingReviewGroupForPage(page);
	if (!group) return null;
	return group.states[item.id] || null;
}

export function applyReportingReviewEvidenceToManifest(manifest = {}) {
	return {
		...manifest,
		pages: (manifest.pages || []).map((page) => {
			const group = reportingReviewGroupForPage(page);
			if (!group) return page;

			return {
				...page,
				reviewGroupId: group.id,
				reviewEvidenceLevel: 'group',
				reviewEvidence: group,
				states: (page.states || []).map((item) => {
					const evidence = reportingReviewStateFor(page, item);
					if (!evidence) return item;

					return {
						...item,
						reviewGroupId: group.id,
						reviewEvidenceLevel: 'state',
						acceptanceCriteriaSource: 'repo-curated',
						suppressGeneratedStateCriteria: true,
						acceptanceCriteria: evidence.gherkin,
						criteriaMaturity: {
							label: 'Curated criteria',
							slug: 'curated',
							description: 'Explicit repo-backed review evidence replaces generated full-page criteria for this state.',
						},
						designRisk: evidence.designRisk,
						evidenceTypes: [
							'Screenshot evidence',
							'State-level curated acceptance criteria',
							'State-level curated design-risk notes',
						],
					};
				}),
			};
		}),
	};
}
