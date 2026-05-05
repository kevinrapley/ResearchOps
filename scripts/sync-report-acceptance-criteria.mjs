/* eslint-env node */

/**
 * @file scripts/sync-report-acceptance-criteria.mjs
 * @summary Refresh generated reporting-site acceptance criteria from current source content.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHomeAcceptanceCriteriaFromSource } from './researchops-home-acceptance.mjs';
import { buildProjectsAcceptanceCriteriaFromSource } from './researchops-projects-acceptance.mjs';

const DEFAULT_SITE_DIR = 'reports-site';

const CRITERIA_BUILDERS = {
	home: {
		path: 'public/index.html',
		generator: 'scripts/researchops-home-acceptance.mjs',
		build: buildHomeAcceptanceCriteriaFromSource,
	},
	projects: {
		path: 'public/pages/projects/index.html',
		generator: 'scripts/researchops-projects-acceptance.mjs',
		build: buildProjectsAcceptanceCriteriaFromSource,
	},
};

const START_GROUP_GHERKIN = `Feature: Start a new research project

  As a user researcher
  I want to define a research project with clear context, objectives and ownership
  So that my team can start research work with shared intent and traceable setup information

  Background:
    Given I am a user researcher
    When I use the start research project journey

  Scenario: Complete the guided project setup safely
    Then I should understand what project information is needed before I commit anything
    And I should be able to define project context, objectives, ownership and notes without entering participant personal data
    And I should be able to review the full project setup before creating the project`;

const START_DEFAULT_STATE_GHERKIN = `Feature: Default state

  Background:
    Given I am a user researcher
    When the Start a new research project loads

  Scenario: Step 1 of 4 Define the project
    Then focus should be applied to the Project name text field
    And the yellow GOV.UK focus style should be present
    Then I should be able to immediately type in the text field

  Scenario: Providing a description
    When I want to enter a description of the project
    Then I should be able to tab, click, or tap in to the Description textarea field
    And the yellow GOV.UK focus style should be present
    Then I should be able to type in the textarea field

  Scenario: Selecting service phase
    When I want to select the service phase my project is in
    Then I should be able to tab, click, or tap in to the Service phase option group
    And the yellow GOV.UK focus style should be present
    Then I should be able to use keyboard, mouse, or mobile controls to select from:
      | Pre-Discovery |
      | Discovery |
      | Alpha |
      | Beta |
      | Live |
      | Retired |

  Scenario: Selecting project status
    When I want to select the status my project is in
    Then I should be able to tab, click, or tap in to the Project status option group
    And the yellow GOV.UK focus style should be present
    Then I should be able to use keyboard, mouse, or mobile controls to select from:
      | Goal setting & problem defining |
      | Planning research |
      | Conducting research |
      | Synthesis & analysis |
      | Shared & socialised research |
      | Monitoring metrics |

  Scenario: Continuing to the next step
    When I have provided the required Step 1 project information
    Then I should be able to tab, click, or tap the Continue button
    And the yellow GOV.UK focus style should be present on the Continue button
    And activating Continue should move me to the next step without losing the answers I have entered`;

const START_AI_ASSISTANCE_GHERKIN = `Feature: AI-assisted wording state

  Background:
    Given I am a user researcher
    When I use the AI-assisted wording state in the start research project journey

  Scenario: Use AI assistance deliberately
    Given AI-assisted wording is available
    Then I should understand what information will be sent to the AI service
    And AI assistance should only run when I explicitly request it
    And I should remain able to reject, amend or ignore AI-suggested wording`;

const GROUP_REVIEW_MODEL = {
	start: {
		title: 'Start research project',
		stateLabels: [
			'Default state',
			'Step 1 completed with project definition',
			'Step 2 default state',
			'Step 2 completed without AI rewrite invoked',
			'Step 2 AI rewrite shown',
			'Step 3 default state',
			'Step 3 completed before check answers',
			'Step 4 check your answers before create project',
		],
		duplicateMarkers: [
			'Feature: Start a new research project',
			'The guided project setup could collect plausible project metadata without making privacy boundaries',
		],
		acceptanceStatus: 'needs-review',
		designRiskStatus: 'needs-review',
		gherkin: START_GROUP_GHERKIN,
		designRisk: {
			risk: 'The start-project journey is the commitment point for the ResearchOps evidence model. Weak context capture can make later studies, participants, sessions, analysis and reporting appear traceable when the project framing is weak or unsafe.',
			impact: 'Teams may create ambiguous project records, over-trust unsupported wording, collect unsafe notes or weaken the evidence-to-insight-to-recommendation chain before research begins.',
			recommendation: 'Review the journey against GOV.UK form, focus, error-summary, hint, button and check-answers patterns. Confirm privacy boundaries, progressive disclosure, validation and keyboard recovery before accepting the walkthrough group.',
		},
		states: {
			'Default state': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: START_DEFAULT_STATE_GHERKIN,
				risk: 'The initial state carries first-interaction risk. Project name focus, yellow GOV.UK focus styling, radio-group operability and the Continue button must work predictably before the user invests effort in the guided journey.',
			},
			'Step 1 completed with project definition': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Step 1 completed with project definition

  Background:
    Given I am a user researcher
    When I have completed Step 1 of the start research project journey

  Scenario: Continue after defining the project
    Then I should see that the project name, description, service phase and status have been retained
    And I should understand that I can continue to the next step
    And I should be able to go back or correct the definition without losing progress`,
				risk: 'A completed first step must show progress without implying that the project is already sufficiently framed for research governance.',
			},
			'Step 2 default state': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Step 2 default state

  Background:
    Given I am a user researcher
    When I reach Step 2 of the start research project journey

  Scenario: Provide objectives and user-group context
    Then I should understand what additional research context is needed
    And I should be able to enter stakeholders, objectives and user groups in clear text fields
    And I should be able to continue using keyboard, mouse or mobile controls`,
				risk: 'This state must ask for research framing in user-centred terms rather than implementation terms that only make sense to Airtable, APIs or internal data models.',
			},
			'Step 2 completed without AI rewrite invoked': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Step 2 completed without assisted wording

  Background:
    Given I am a user researcher
    When I have entered stakeholders, objectives and user groups myself

  Scenario: Continue with researcher-authored wording
    Then I should see that my own wording has been retained
    And I should be able to continue without being asked to replace it
    And I should remain able to amend the content before creating the project`,
				risk: 'Researcher-authored wording must remain a complete and trusted path so the service does not normalise unnecessary automation or weaken accountability for project framing.',
			},
			'Step 2 AI rewrite shown': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: START_AI_ASSISTANCE_GHERKIN,
				risk: 'AI-suggested wording creates provenance and accountability risk unless the suggestion is clearly attributable, optional and under user control.',
			},
			'Step 3 default state': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Step 3 default state

  Background:
    Given I am a user researcher
    When I reach Step 3 of the start research project journey

  Scenario: Add ownership and notes safely
    Then I should understand what ownership, governance or planning information is needed
    And I should be able to enter notes without being encouraged to include participant personal data
    And I should be able to continue without needing knowledge of internal data structures`,
				risk: 'The ownership and notes step can become a privacy leakage point if it invites broad free-text capture without clear boundaries.',
			},
			'Step 3 completed before check answers': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Step 3 completed before check answers

  Background:
    Given I am a user researcher
    When I have entered ownership and notes

  Scenario: Move toward review after ownership and notes are entered
    Then I should understand that this information will be included in the project record
    And I should still be able to correct earlier answers
    And my answers should remain available when I continue to the review step`,
				risk: 'Project setup mistakes propagate into later ResearchOps journeys, so correction routes must remain available until the project is created.',
			},
			'Step 4 check your answers before create project': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Check answers before creating the project

  Background:
    Given I am a user researcher
    When I reach the check-your-answers step

  Scenario: Review the project setup before committing it
    Then I should be able to review the full project setup
    And I should be able to identify and change inaccurate answers
    And I should understand that creating the project commits the setup information to the ResearchOps record`,
				risk: 'The check-answers state is the final safeguard against weak or incorrect project records and should follow GOV.UK summary-list and change-link conventions.',
			},
		},
	},
	'participant-consent': {
		title: 'Participant consent',
		stateLabels: [
			'Consent workspace loaded',
			'Missing study context error state',
			'No published consent form state',
			'No participants state',
			'Participant selected for consent review',
		],
		duplicateMarkers: [
			'Feature: Record participant consent',
			'Feature: Participant consent',
			'Participant consent screens may not separate setup blockers, participant selection and auditable consent recording clearly enough',
		],
		acceptanceStatus: 'needs-review',
		designRiskStatus: 'needs-review',
		gherkin: `Feature: Participant consent

  As a user researcher
  I want to review and record consent within the correct participant, study and consent-form context
  So that consent evidence is clear, current and auditable before research activity continues

  Background:
    Given I am a user researcher
    When I use the participant consent journey

  Scenario: Work within the correct consent context
    Then I should see the project, study, participant and consent-form context needed to trust the consent record
    And I should be prevented from recording consent where the required context is missing or incomplete

  Scenario: Distinguish setup blockers from valid consent states
    Then I should understand whether the blocker is missing route context, no published consent form or no participants
    And each blocker should provide a recovery route that matches the problem

  Scenario: Review participant consent safely
    Given a participant is selected
    Then I should see which participant, study and consent form the record relates to
    And I should understand required statements, optional permissions and withdrawal controls before making changes

  Scenario: Use the consent journey accessibly
    Then consent options should be semantically grouped and labelled
    And status messages, blockers and validation should be exposed to assistive technology`,
		designRisk: {
			risk: 'Participant consent is a high-trust research governance activity. Ambiguity about participant, study or consent-form context creates ethical, operational and evidence-integrity risk.',
			impact: 'Research may proceed without clear, current and reviewable consent evidence, or consent may be attributed to the wrong participant, study or consent form.',
			recommendation: 'Review blocker states, participant selection, consent form publication state, grouped controls, status messaging and recovery routes against GOV.UK form patterns and WCAG 2.2 AA expectations.',
		},
		states: {
			'Consent workspace loaded': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Consent workspace loaded

  Background:
    Given I am a user researcher
    When the participant consent workspace loads with valid study context

  Scenario: Understand the available consent action
    Then I should be able to identify the study context and published consent form
    And I should be able to identify whether participants are available for consent review
    And I should understand the next consent action needed before a session proceeds`,
				risk: 'The loaded state must make the selected study context visible enough to prevent accidental consent capture against the wrong study.',
			},
			'Missing study context error state': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Missing study context error state

  Background:
    Given I am a user researcher
    When the participant consent page is missing project or study context

  Scenario: Recover from missing consent route context
    When required consent context is missing or invalid
    Then I should see GOV.UK-compatible validation or blocker messaging
    And the problem should be exposed through an error summary or equivalent page-level message
    And I should be given a clear recovery route rather than an empty consent screen`,
				risk: 'Missing-context states should be treated as controlled error states and must not resemble valid empty states.',
			},
			'No published consent form state': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: No published consent form state

  Background:
    Given I am a user researcher
    When no published consent form exists for the study

  Scenario: Block consent capture until a consent form is published
    Then I should understand that participant consent cannot be captured yet
    And I should know that a consent form must be created or published first
    And I should be able to navigate to the appropriate study setup action`,
				risk: 'Capturing consent without a published consent form would weaken consent provenance, so the blocked state should be explicit and actionable.',
			},
			'No participants state': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: No participants state

  Background:
    Given I am a user researcher
    When no participants are available for the study

  Scenario: Block consent capture until participants exist
    Then I should understand that consent cannot be captured yet
    And I should know how to add or schedule participants before returning to consent
    And the state should not be confused with a participant-loading failure`,
				risk: 'The state should distinguish between no participant records and a participant-loading failure to avoid incorrect operational decisions.',
			},
			'Participant selected for consent review': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Participant selected for consent review

  Background:
    Given I am a user researcher
    When I select a participant for consent review

  Scenario: Review consent for the selected participant
    Then I should see which participant is selected
    And I should understand the consent options that apply to that participant and study
    And I should be able to continue without confusing this participant with another record`,
				risk: 'The selected-participant state carries the highest risk of misattribution, so participant identity, pseudonym and consent scope must be unambiguous.',
			},
		},
	},
	analysis: {
		title: 'Study synthesis',
		stateLabels: [
			'Missing study ID error state',
			'Empty evidence state',
			'Evidence available before working clusters',
			'Working cluster grouping created',
			'Evidence added to working cluster grouping',
			'Theme creation hidden before evidence is grouped',
			'Theme created with evidence traceability',
		],
		duplicateMarkers: [
			'Feature: Synthesize research evidence',
			'Synthesis states may make clusters and themes look authoritative before evidence quantity, provenance and confidence are clear',
		],
		acceptanceStatus: 'needs-review',
		designRiskStatus: 'needs-review',
		gherkin: `Feature: Synthesize research evidence

  As a user researcher
  I want to group evidence and create traceable themes
  So that insights and recommendations remain connected to source evidence

  Background:
    Given I am a user researcher
    When I use the study synthesis journey

  Scenario: Maintain traceability from evidence to theme
    Given evidence is available for synthesis
    Then I should be able to review evidence provenance before grouping it
    And I should be able to create working clusters before turning evidence into themes
    And created themes should remain connected to their source evidence

  Scenario: Prevent unsupported theme creation
    Given no evidence has been added to a working cluster
    Then I should be prevented from creating a theme
    And I should understand what evidence action is needed before the theme action becomes available

  Scenario: Use the analysis journey accessibly
    Then evidence selection, cluster creation, theme creation and blocked states should be keyboard operable
    And status changes should be exposed clearly enough for assistive technology users`,
		designRisk: {
			risk: 'The analysis journey is central to ResearchOps traceability. If the UI weakens the evidence-to-theme chain, the service can produce recommendations that appear stronger than the underlying evidence supports.',
			impact: 'Insights and recommendations could be accepted without sufficient evidence provenance, confidence context or an auditable analytical decision trail.',
			recommendation: 'Review evidence loading, grouping, provisional clusters, blocked theme creation, provenance details, status messaging and GOV.UK component conformance before accepting the analysis group.',
		},
		states: {
			'Missing study ID error state': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Missing study ID error state

  Background:
    Given I am a user researcher
    When the study synthesis page is missing a study ID

  Scenario: Recover from missing study context
    When required study context is missing or invalid
    Then I should see GOV.UK-compatible validation or blocker messaging
    And I should be told that synthesis cannot start
    And I should be able to return to a valid study context`,
				risk: 'This state should remain an explicit route-context error and should not be treated as an operational synthesis state.',
			},
			'Empty evidence state': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Empty evidence state

  Background:
    Given I am a user researcher
    When the study has no captured evidence notes

  Scenario: Understand that no evidence is available
    Then I should understand that synthesis cannot proceed yet
    And I should know what evidence capture action is needed before analysis can start
    And the page should not imply that analysis is complete`,
				risk: 'The empty-evidence state must not imply that analysis is complete or that absence of evidence is itself an insight.',
			},
			'Evidence available before working clusters': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Evidence available before working clusters

  Background:
    Given I am a user researcher
    When evidence is available for the study

  Scenario: Review evidence before clustering
    Then I should be able to review source evidence before grouping it
    And I should understand that a working cluster is needed before evidence can be added
    And I should have enough provenance context to make a defensible analytical decision`,
				risk: 'Available evidence should preserve provenance cues so later clusters and themes can be audited.',
			},
			'Working cluster grouping created': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Working cluster grouping created

  Background:
    Given I am a user researcher
    When I have created a working cluster grouping

  Scenario: Treat a working cluster as provisional
    Then I should understand that the cluster is provisional
    And I should be able to add evidence before treating it as a theme
    And the cluster should not be presented with the same authority as a final insight`,
				risk: 'Working clusters are provisional and must not be presented with the same authority as validated themes.',
			},
			'Evidence added to working cluster grouping': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Evidence added to working cluster grouping

  Background:
    Given I am a user researcher
    When selected evidence has been added to a working cluster

  Scenario: Add evidence to a working cluster
    Then I should be able to see what evidence belongs to the cluster
    And I should understand how cluster membership can be challenged or changed later
    And the evidence movement should remain auditable`,
				risk: 'Evidence movement should be auditable so that cluster membership can be corrected or challenged later.',
			},
			'Theme creation hidden before evidence is grouped': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Theme creation hidden before evidence is grouped

  Background:
    Given I am a user researcher
    When no evidence has been grouped into a working cluster

  Scenario: Block theme creation without grouped evidence
    Then theme creation should remain unavailable
    And I should understand what evidence action is needed before I can create a theme
    And the unavailable action should not be presented as a successful analytical outcome`,
				risk: 'Blocking unsupported theme creation is a core evidence-integrity safeguard and the recovery route should be explicit and keyboard accessible.',
			},
			'Theme created with evidence traceability': {
				acceptanceStatus: 'needs-review',
				designRiskStatus: 'needs-review',
				gherkin: `Feature: Theme created with evidence traceability

  Background:
    Given I am a user researcher
    When a theme has been created from grouped evidence

  Scenario: Review a created theme with traceability
    Then I should see that the theme remains connected to its source evidence
    And I should be able to inspect enough provenance to support later recommendations
    And the theme should not appear stronger than the evidence behind it`,
				risk: 'The created-theme state must show enough provenance to stop themes becoming detached claims.',
			},
		},
	},
};

export function buildHomeAcceptanceGherkin() {
	return buildHomeAcceptanceCriteriaFromSource();
}

export function buildProjectsAcceptanceGherkin() {
	return buildProjectsAcceptanceCriteriaFromSource();
}

export const buildResearchOpsHomeAcceptanceCriteria = buildHomeAcceptanceGherkin;
export const buildResearchOpsProjectsAcceptanceCriteria = buildProjectsAcceptanceGherkin;

export function buildStateAcceptanceGherkin(pageId) {
	if (pageId === 'home') return buildHomeAcceptanceGherkin();
	if (pageId === 'projects') return buildProjectsAcceptanceGherkin();
	return '';
}

function escapeHtml(value = '') {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function findPage(manifest, pageId) {
	return (manifest.pages || []).find((page) => page.id === pageId);
}

function findDefaultState(page, pageId) {
	const defaultState = (page.states || []).find((state) => state.id === 'default');
	if (!defaultState) throw new Error(`No default ${pageId} state found in reports-site manifest.`);
	return defaultState;
}

function removeExistingInjectedAssets(html) {
	return html
		.replace(/\n?<style id="reporting-review-grouping-styles">[\s\S]*?<\/style>/g, '')
		.replace(/\n?<script id="reporting-review-grouping-script">[\s\S]*?<\/script>/g, '');
}

function buildRuntimeReviewScript() {
	return `(function () {
  const GROUPS = ${JSON.stringify(GROUP_REVIEW_MODEL, null, 2)};

  function textOf(element) {
    return (element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim();
  }

  function createElement(name, className, text) {
    const element = document.createElement(name);

    if (className) {
      element.className = className;
    }

    if (typeof text === 'string') {
      element.textContent = text;
    }

    return element;
  }

  function formatStatus(status) {
    return String(status || 'needs-review')
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function createStatusTag(status) {
    const tag = createElement('span', 'reporting-review__status reporting-review__status--' + String(status || 'needs-review'));
    tag.textContent = formatStatus(status);
    return tag;
  }

  function createHeadingWithStatus(level, text, status) {
    const heading = createElement(level, 'reporting-review__subheading');
    heading.append(document.createTextNode(text + ' '));
    heading.append(createStatusTag(status));
    return heading;
  }

  function createPre(text) {
    const pre = createElement('pre', 'reporting-review__pre');
    pre.textContent = text;
    return pre;
  }

  function createRiskList(risk, status) {
    const dl = createElement('dl', 'reporting-review__risk-list');
    const entries = [
      ['Design risk', risk.risk || risk],
      ['Impact', risk.impact || 'This state may weaken ResearchOps traceability, accessibility or user confidence if the scenario is accepted without review.'],
      ['Recommended change', risk.recommendation || 'Review the scenario against ResearchOps intent, GOV.UK Design System conformance, WCAG 2.2 AA expectations and the evidence-to-insight-to-recommendation model.'],
      ['Owner', 'UCD team'],
      ['Status', formatStatus(status)],
    ];

    for (const [term, description] of entries) {
      dl.append(createElement('dt', '', term));
      dl.append(createElement('dd', '', description));
    }

    return dl;
  }

  function createGroupPanel(group) {
    const panel = createElement('section', 'reporting-review reporting-review--group');
    const details = createElement('details', 'reporting-review__details');
    const summary = createElement('summary', 'reporting-review__summary-control', 'What this grouping should support');

    details.open = true;
    panel.dataset.reportingReviewLevel = 'group';
    panel.append(createElement('h3', 'reporting-review__heading', group.title + ' — group-level review evidence'));
    details.append(summary);
    details.append(createElement('p', 'reporting-review__summary', 'Applies once to the full grouping. State cards below should only contain scenario-specific review evidence.'));
    details.append(createHeadingWithStatus('h4', 'Gherkin acceptance criteria', group.acceptanceStatus));
    details.append(createPre(group.gherkin));
    details.append(createHeadingWithStatus('h4', 'Design-risk notes', group.designRiskStatus));
    details.append(createRiskList(group.designRisk, group.designRiskStatus));
    panel.append(details);
    return panel;
  }

  function createStatePanel(label, state) {
    const panel = createElement('section', 'reporting-review reporting-review--state');
    const details = createElement('details', 'reporting-review__details');
    const summary = createElement('summary', 'reporting-review__summary-control', 'What this state should support');

    details.open = true;
    panel.dataset.reportingReviewLevel = 'state';
    panel.append(createElement('h4', 'reporting-review__heading', label + ' — state-specific review evidence'));
    details.append(summary);
    details.append(createElement('p', 'reporting-review__summary', 'Specific to this screenshot state. Shared grouping criteria and shared design risk are shown once at grouping level.'));
    details.append(createHeadingWithStatus('h5', 'Gherkin acceptance criteria', state.acceptanceStatus));
    details.append(createPre(state.gherkin));
    details.append(createHeadingWithStatus('h5', 'Design-risk notes', state.designRiskStatus));
    details.append(createRiskList({ risk: state.risk }, state.designRiskStatus));
    panel.append(details);
    return panel;
  }

  function findSmallestContainerContaining(root, text, requiredText) {
    const candidates = Array.from(root.querySelectorAll('article, section, details, div, li'))
      .filter((element) => {
        if (element.classList.contains('reporting-review')) {
          return false;
        }

        const elementText = textOf(element);
        return elementText.includes(text) && (!requiredText || elementText.includes(requiredText));
      })
      .sort((left, right) => textOf(left).length - textOf(right).length);

    return candidates[0] || null;
  }

  function findStateCard(label) {
    return findSmallestContainerContaining(document.body, label, 'Screenshot evidence') || findSmallestContainerContaining(document.body, label);
  }

  function hideDuplicatedReviewBlocks(group, root) {
    for (const marker of group.duplicateMarkers || []) {
      const candidates = Array.from(root.querySelectorAll('details, pre, code, dl, table, section, div'))
        .filter((element) => {
          if (element.classList.contains('reporting-review') || element.classList.contains('reporting-review-hidden-duplicate')) {
            return false;
          }

          const elementText = textOf(element);
          return elementText.includes(marker) && elementText.length < 9000;
        })
        .sort((left, right) => textOf(left).length - textOf(right).length);

      for (const candidate of candidates) {
        if (candidate.closest('.reporting-review-hidden-duplicate')) {
          continue;
        }

        candidate.classList.add('reporting-review-hidden-duplicate');
        candidate.setAttribute('hidden', '');
        break;
      }
    }
  }

  function insertAfterStateControls(card, panel) {
    const controls = Array.from(card.querySelectorAll('button, a'))
      .find((element) => textOf(element) === 'Design-risk notes' || textOf(element) === 'State-level acceptance criteria');

    if (controls && controls.parentElement && controls.parentElement.parentElement === card) {
      controls.parentElement.insertAdjacentElement('afterend', panel);
      return;
    }

    const existingDetails = card.querySelector('details');

    if (existingDetails) {
      existingDetails.insertAdjacentElement('beforebegin', panel);
      return;
    }

    card.append(panel);
  }

  function applyGroup(group) {
    const stateCards = group.stateLabels.map((label) => [label, findStateCard(label)]).filter(([, card]) => card);

    if (stateCards.length === 0) {
      return;
    }

    const firstCard = stateCards[0][1];

    if (!firstCard.parentElement.querySelector('[data-reporting-review-level="group"][data-reporting-review-group="' + group.title + '"]')) {
      const groupPanel = createGroupPanel(group);
      groupPanel.dataset.reportingReviewGroup = group.title;
      firstCard.insertAdjacentElement('beforebegin', groupPanel);
    }

    for (const [label, card] of stateCards) {
      hideDuplicatedReviewBlocks(group, card);

      if (!card.querySelector('[data-reporting-review-level="state"]')) {
        insertAfterStateControls(card, createStatePanel(label, group.states[label] || {
          acceptanceStatus: 'needs-review',
          designRiskStatus: 'needs-review',
          gherkin: 'Feature: Review this state\\n\\n  Scenario: Review this state\\n    Then I should understand the ResearchOps task supported by this state',
          risk: 'This state needs a scenario-specific design-risk review.',
        }));
      }
    }
  }

  function applyReportingReviewGrouping() {
    if (document.documentElement.dataset.reportingReviewGroupingApplied === 'true') {
      return;
    }

    document.documentElement.dataset.reportingReviewGroupingApplied = 'true';

    for (const group of Object.values(GROUPS)) {
      applyGroup(group);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyReportingReviewGrouping);
  } else {
    applyReportingReviewGrouping();
  }
})();`;
}

function buildRuntimeReviewStyles() {
	return `.reporting-review {
  border: 2px solid #1d70b8;
  margin: 16px 0;
  padding: 16px;
}

.reporting-review--group {
  background: #f3f2f1;
}

.reporting-review--state {
  border-color: #b1b4b6;
}

.reporting-review__heading,
.reporting-review__subheading {
  margin-top: 0;
}

.reporting-review__summary,
.reporting-review__summary-control {
  margin-top: 0;
}

.reporting-review__summary-control {
  cursor: pointer;
  font-weight: 700;
}

.reporting-review__pre {
  background: #ffffff;
  border: 1px solid #b1b4b6;
  overflow-x: auto;
  padding: 12px;
  white-space: pre-wrap;
}

.reporting-review__status {
  background: #f47738;
  color: #0b0c0c;
  display: inline-block;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
  padding: 4px 8px;
  text-transform: uppercase;
  vertical-align: middle;
}

.reporting-review__risk-list {
  display: grid;
  gap: 8px 16px;
  grid-template-columns: minmax(120px, 180px) 1fr;
  margin: 0;
}

.reporting-review__risk-list dt {
  font-weight: 700;
}

.reporting-review__risk-list dd {
  margin: 0;
}`;
}

export function applyReportingReviewGrouping(html) {
	const cleanHtml = removeExistingInjectedAssets(html);
	const style = `<style id="reporting-review-grouping-styles">\n${buildRuntimeReviewStyles()}\n</style>`;
	const script = `<script id="reporting-review-grouping-script">\n${buildRuntimeReviewScript()}\n</script>`;

	if (cleanHtml.includes('</head>')) {
		return cleanHtml.replace('</head>', `${style}\n</head>`).replace('</body>', `${script}\n</body>`);
	}

	return `${cleanHtml}\n${style}\n${script}\n`;
}

function replaceHtmlCriteria(html, pageId, oldCriteria, nextCriteria) {
	const oldEscaped = escapeHtml(oldCriteria || '');
	const nextEscaped = escapeHtml(nextCriteria || '');

	if (oldEscaped && html.includes(oldEscaped)) {
		return html.replace(oldEscaped, nextEscaped);
	}

	const articlePattern = new RegExp(
		`(<article\\b[^>]*id=["']${pageId}["'][^>]*>[\\s\\S]*?<pre\\b[^>]*class=["']gherkin-criteria["'][^>]*>\\s*<code>)([\\s\\S]*?)(<\\/code>\\s*<\\/pre>[\\s\\S]*?<\\/article>)`,
		'i'
	);

	if (!articlePattern.test(html)) {
		throw new Error(`Could not find the ${pageId} acceptance criteria block in reports-site/index.html.`);
	}

	return html.replace(articlePattern, `$1${nextEscaped}$3`);
}

function syncPageAcceptanceCriteria(manifest, html, pageId, config) {
	const page = findPage(manifest, pageId);
	if (!page) {
		return {
			pageId,
			changed: false,
			skipped: true,
			reason: `No ${pageId} page entry found in reports-site manifest.`,
		};
	}

	const state = findDefaultState(page, pageId);
	const previousCriteria = state.acceptanceCriteria || '';
	const nextCriteria = config.build();

	state.acceptanceCriteria = nextCriteria;
	state.criteriaSource = {
		type: 'source-derived',
		path: config.path,
		generator: config.generator,
	};

	return {
		pageId,
		changed: previousCriteria !== nextCriteria,
		previousLength: previousCriteria.length,
		nextLength: nextCriteria.length,
		html: replaceHtmlCriteria(html, pageId, previousCriteria, nextCriteria),
	};
}

export function syncReportAcceptanceCriteria(options = {}) {
	const siteDir = typeof options === 'string' ? options : options.siteDir || DEFAULT_SITE_DIR;
	const manifestPath = path.join(siteDir, 'manifest.json');
	const indexPath = path.join(siteDir, 'index.html');

	if (!fs.existsSync(manifestPath)) throw new Error(`Missing ${manifestPath}.`);
	if (!fs.existsSync(indexPath)) throw new Error(`Missing ${indexPath}.`);

	const manifest = readJson(manifestPath);
	let html = fs.readFileSync(indexPath, 'utf8');
	const pages = typeof options === 'string' ? Object.keys(CRITERIA_BUILDERS) : options.pages || Object.keys(CRITERIA_BUILDERS);
	const results = [];

	for (const pageId of pages) {
		const config = CRITERIA_BUILDERS[pageId];
		if (!config) throw new Error(`No acceptance criteria builder registered for ${pageId}.`);

		const result = syncPageAcceptanceCriteria(manifest, html, pageId, config);
		if (result.html) html = result.html;
		results.push(Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'html')));
	}

	const htmlBeforeGrouping = html;
	html = applyReportingReviewGrouping(html);
	const groupingChanged = htmlBeforeGrouping !== html;

	writeJson(manifestPath, manifest);
	fs.writeFileSync(indexPath, html, 'utf8');

	const changed = results.some((result) => result.changed) || groupingChanged;

	return {
		changed,
		results,
		previousLength: results[0]?.previousLength || 0,
		nextLength: results[0]?.nextLength || 0,
		groupingChanged,
		groupingScriptApplied: true,
	};
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
	const result = syncReportAcceptanceCriteria({ siteDir: process.argv[2] || DEFAULT_SITE_DIR });
	console.log(JSON.stringify(result, null, 2));
}

export { GROUP_REVIEW_MODEL };