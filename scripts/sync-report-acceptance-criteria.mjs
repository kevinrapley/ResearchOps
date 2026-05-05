import fs from 'node:fs';
import path from 'node:path';

const HOME_ACCEPTANCE_GHERKIN = `Feature: Access the ResearchOps home page

  As a user researcher
  I want to access the ResearchOps home page
  So that I can choose the right ResearchOps journey for my work

  Background:
    Given I am a user researcher
    When I visit the ResearchOps home page

  Scenario: View the ResearchOps service identity
    Then I should see the service name "ResearchOps Demo Suite"
    And I should see the tagline "Objective orientated applied user research done well."
    And I should see the page heading "ResearchOps Demo Suite"
    And I should see introductory text that says "Use ResearchOps to structure applied user research with operations, governance and accessibility baked in."

  Scenario: Understand that the service is a prototype
    Then I should see a prototype banner
    And the banner should say "This is a ResearchOps prototype. Do not enter real participant personal data."

  Scenario: Navigate using the primary navigation
    Then I should see primary navigation links for:
      | Home |
      | Start research project |
      | Projects |
    And the "Home" navigation item should be shown as the current page

  Scenario: Start with a research project
    Then I should see guidance headed "Start by creating a research project"
    And I should see text explaining that a project holds studies, participants, sessions, notes, evidence, insights and recommendations
    And the primary call to action should be "Start a research project"

  Scenario: Review later ResearchOps tasks
    Then I should see a section called "What you can do after creating a project"
    And I should see orientation cards for:
      | Task |
      | Set clear research objectives |
      | Recruit participants for user research studies |
      | Turn research evidence into recommendations |

  Scenario: Access the home page using a keyboard
    Given I am navigating with a keyboard
    Then I should be able to move focus through the primary navigation links
    And I should be able to move focus to "Start a research project"
    And I should be able to activate links, buttons and form controls without a mouse`;

const PROJECTS_ACCEPTANCE_GHERKIN = `Feature: Review research projects

  As a user researcher
  I want to review existing research projects
  So that I can find the right project and continue the right ResearchOps task

  Background:
    Given I am a user researcher
    When I visit the projects page

  Scenario: View the Projects page identity
    Then I should see the service name "ResearchOps Demo Suite"
    And I should see the page heading "Projects"
    And I should see introductory text that says "Review research projects created in ResearchOps."

  Scenario: Start a new project from the Projects page
    Then I should see the primary action "Start a research project"
    When I select "Start a research project"
    Then I should be taken to the start research project service

  Scenario: Review loaded project records
    When project records load successfully
    Then each project card should expose project title, phase, status, description, user groups, stakeholders and objectives
    And each project card should provide a dashboard link for continuing work on that project

  Scenario: Recover when there are no projects yet
    When no project records are available
    Then I should see a status message headed "No projects yet"
    And I should be able to select "Start a research project"

  Scenario: Access the Projects page using a keyboard
    Given I am navigating with a keyboard
    Then I should be able to move focus to the main content
    And I should be able to activate project dashboard links without a mouse`;

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
    gherkin: `Feature: Start a new research project

  As a user researcher
  I want to define a research project with clear context, objectives and ownership
  So that my team can start research work with shared intent and traceable setup information

  Background:
    Given I am a user researcher
    When I use the start research project journey

  Scenario: Complete the guided project setup safely
    Then I should understand what project information is needed before I commit anything
    And I should be able to define project context, objectives, ownership and notes without entering participant personal data
    And I should be able to review the full project setup before creating the project

  Scenario: Use AI assistance deliberately
    Given AI-assisted wording is available
    Then I should understand what information will be sent to the AI service
    And AI assistance should only run when I explicitly request it
    And I should remain able to reject, amend or ignore AI-suggested wording

  Scenario: Recover from missing or invalid project information
    When required project information is missing or invalid
    Then I should see GOV.UK-compatible validation messages
    And validation errors should be exposed through an error summary and field-level errors
    And I should be able to recover without losing the answers I have already entered

  Scenario: Use the full journey accessibly
    Then the journey should preserve a clear heading hierarchy
    And labels, hints, errors, buttons and check-your-answers rows should be exposed in a logical reading order
    And I should be able to complete the journey using a keyboard, zoom, reflow and assistive technology`,
    designRisk: {
      risk: 'The start-project journey is the commitment point for the ResearchOps evidence model. Weak context capture can make later studies, participants, sessions, analysis and reporting appear traceable when the project framing is weak or unsafe.',
      impact: 'Teams may create ambiguous project records, over-trust AI-assisted framing, collect unsafe notes or weaken the evidence-to-insight-to-recommendation chain before research begins.',
      recommendation: 'Review the journey against GOV.UK form, error-summary, hint, button and check-answers patterns. Confirm privacy copy, AI disclosure, progressive disclosure, validation and keyboard recovery before accepting the walkthrough group.',
    },
    states: {
      'Default state': {
        gherkin: `Scenario: Understand the first step before entering data
  Given I am viewing the default start-project state
  Then I should understand the purpose of the guided process
  And I should know what level of project detail is needed to continue`,
        risk: 'The initial state can overload the user if it asks for project detail before explaining why the project record matters.',
      },
      'Step 1 completed with project definition': {
        gherkin: `Scenario: Continue after defining the project
  Given I have entered the project name, description, phase and status
  Then I should see that my project definition has been retained
  And I should be able to continue without losing orientation in the guided process`,
        risk: 'A completed first step must show progress without implying that the project is already sufficiently framed for research governance.',
      },
      'Step 2 default state': {
        gherkin: `Scenario: Add research framing without being forced into AI use
  Given I have reached the stakeholders, objectives and user groups step
  Then I should understand what additional research context is needed
  And I should be able to proceed manually without being nudged into AI-supported wording`,
        risk: 'The state must not make AI assistance look mandatory or more authoritative than researcher-authored objectives.',
      },
      'Step 2 completed without AI rewrite invoked': {
        gherkin: `Scenario: Continue with researcher-authored objectives
  Given I have entered stakeholders, objectives and user groups myself
  Then I should be able to continue without using AI-generated wording
  And manual completion should remain a complete and valid path`,
        risk: 'Manual completion must remain first-class so researchers are not indirectly coerced into AI use.',
      },
      'Step 2 AI rewrite shown': {
        gherkin: `Scenario: Review AI-suggested wording under user control
  Given an AI rewrite suggestion is shown
  Then I should be able to distinguish suggested wording from my original wording
  And I should be able to reject, amend or ignore the suggestion without losing my original context`,
        risk: 'AI-suggested wording creates provenance and accountability risk unless attribution and user control are visible.',
      },
      'Step 3 default state': {
        gherkin: `Scenario: Add ownership and notes safely
  Given I have reached the ownership and notes step
  Then I should understand what governance or planning information is needed
  And I should not need to understand internal data structures to complete the step`,
        risk: 'The form should not expose implementation concepts that are meaningful to Airtable or APIs but not to user researchers.',
      },
      'Step 3 completed before check answers': {
        gherkin: `Scenario: Move toward review after ownership and notes are entered
  Given I have entered ownership and notes
  Then I should understand that this information will be included in the project record
  And I should still be able to correct earlier answers`,
        risk: 'Project setup mistakes propagate into later ResearchOps journeys, so correction routes must remain available.',
      },
      'Step 4 check your answers before create project': {
        gherkin: `Scenario: Check answers before creating the project
  Given I have reached the check-your-answers step
  Then I should be able to review the full project setup
  And I should be able to change inaccurate answers before creating the project`,
        risk: 'The check-your-answers state is the final safeguard against weak or incorrect project records and should follow GOV.UK summary-list and change-link conventions.',
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
      'Participant consent screens may not separate setup blockers, participant selection and auditable consent recording clearly enough',
    ],
    gherkin: `Feature: Record participant consent

  As a user researcher
  I want to record and review participant consent for a study
  So that research only proceeds where consent is clear, current and auditable

  Background:
    Given I am a user researcher
    When I use the participant consent journey

  Scenario: Work within the correct study context
    Then I should see the project and study context needed to trust the consent record
    And I should be prevented from recording consent when required context is missing

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
        gherkin: `Scenario: Use the loaded consent workspace
  Given the participant consent workspace has loaded with study context
  Then I should be able to identify the published consent form and available participants
  And I should understand the next consent action needed before a session proceeds`,
        risk: 'The loaded state must make the selected study context visible enough to prevent accidental consent capture against the wrong study.',
      },
      'Missing study context error state': {
        gherkin: `Scenario: Recover from missing consent route context
  Given project or study context is missing
  Then I should be told that participant consent cannot continue
  And I should be given a clear recovery route rather than an empty consent screen`,
        risk: 'Missing-context states should be treated as controlled error states and must not resemble valid empty states.',
      },
      'No published consent form state': {
        gherkin: `Scenario: Block consent capture until a consent form is published
  Given no published consent form exists for the study
  Then I should understand that participant consent cannot be captured yet
  And I should know that a consent form must be created or published first`,
        risk: 'Capturing consent without a published consent form would weaken consent provenance, so the blocked state should be explicit and actionable.',
      },
      'No participants state': {
        gherkin: `Scenario: Block consent capture until participants exist
  Given no participants are available for the study
  Then I should understand that consent cannot be captured yet
  And I should know how to add or schedule participants before returning to consent`,
        risk: 'The state should distinguish between no participant records and a participant-loading failure to avoid incorrect operational decisions.',
      },
      'Participant selected for consent review': {
        gherkin: `Scenario: Review consent for the selected participant
  Given I have selected a participant
  Then I should see which participant is selected
  And I should understand the consent options that apply to that participant and study`,
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
    gherkin: `Feature: Synthesize research evidence

  As a user researcher
  I want to group evidence and create traceable themes
  So that insights and recommendations remain connected to source evidence

  Background:
    Given I am a user researcher
    When I use the study synthesis journey

  Scenario: Work from a valid study context
    Then synthesis should only proceed when a study context is present
    And missing context should be presented as a recoverable blocker

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
        gherkin: `Scenario: Recover from missing study context
  Given the study ID is missing
  Then I should be told that synthesis cannot start
  And I should be able to return to a valid study context`,
        risk: 'This state should remain an explicit route-context error and should not be treated as an operational synthesis state.',
      },
      'Empty evidence state': {
        gherkin: `Scenario: Understand that no evidence is available
  Given the study has no captured evidence notes
  Then I should understand that synthesis cannot proceed yet
  And I should know what evidence capture action is needed before analysis can start`,
        risk: 'The empty-evidence state must not imply that analysis is complete or that absence of evidence is itself an insight.',
      },
      'Evidence available before working clusters': {
        gherkin: `Scenario: Review evidence before clustering
  Given evidence is available for the study
  Then I should be able to review source evidence before grouping it
  And I should understand that a working cluster is needed before evidence can be added`,
        risk: 'Available evidence should preserve provenance cues so later clusters and themes can be audited.',
      },
      'Working cluster grouping created': {
        gherkin: `Scenario: Treat a working cluster as provisional
  Given I have created a working cluster grouping
  Then I should understand that it is provisional
  And I should be able to add evidence before treating it as a theme`,
        risk: 'Working clusters are provisional and must not be presented with the same authority as validated themes.',
      },
      'Evidence added to working cluster grouping': {
        gherkin: `Scenario: Add evidence to a working cluster
  Given selected evidence has been added to a working cluster
  Then I should be able to see what evidence belongs to the cluster
  And I should understand how cluster membership can be challenged or changed later`,
        risk: 'Evidence movement should be auditable so that cluster membership can be corrected or challenged later.',
      },
      'Theme creation hidden before evidence is grouped': {
        gherkin: `Scenario: Block theme creation without grouped evidence
  Given no evidence has been grouped into a working cluster
  Then theme creation should remain unavailable
  And I should understand what evidence action is needed before I can create a theme`,
        risk: 'Blocking unsupported theme creation is a core evidence-integrity safeguard and the recovery route should be explicit and keyboard accessible.',
      },
      'Theme created with evidence traceability': {
        gherkin: `Scenario: Review a created theme with traceability
  Given a theme has been created from grouped evidence
  Then I should see that the theme remains connected to its source evidence
  And I should be able to inspect enough provenance to support later recommendations`,
        risk: 'The created-theme state must show enough provenance to stop themes becoming detached claims.',
      },
    },
  },
};

export function buildHomeAcceptanceGherkin() {
  return HOME_ACCEPTANCE_GHERKIN;
}

export function buildProjectsAcceptanceGherkin() {
  return PROJECTS_ACCEPTANCE_GHERKIN;
}

export const buildResearchOpsHomeAcceptanceCriteria = buildHomeAcceptanceGherkin;
export const buildResearchOpsProjectsAcceptanceCriteria = buildProjectsAcceptanceGherkin;

export function buildStateAcceptanceGherkin(pageId) {
  if (pageId === 'home') {
    return buildHomeAcceptanceGherkin();
  }

  if (pageId === 'projects') {
    return buildProjectsAcceptanceGherkin();
  }

  return '';
}

function normaliseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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
    return (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
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
      ['Status', status || 'Needs UCD review'],
    ];

    for (const [term, description] of entries) {
      dl.append(createElement('dt', '', term));
      dl.append(createElement('dd', '', description));
    }

    return dl;
  }

  function createGroupPanel(group) {
    const panel = createElement('section', 'reporting-review reporting-review--group');
    panel.dataset.reportingReviewLevel = 'group';
    panel.append(createElement('h3', 'reporting-review__heading', group.title + ' — group-level review evidence'));
    panel.append(createElement('p', 'reporting-review__summary', 'Applies once to the full grouping. State cards below should only contain scenario-specific review evidence.'));
    panel.append(createElement('h4', 'reporting-review__subheading', 'Gherkin acceptance criteria'));
    panel.append(createPre(group.gherkin));
    panel.append(createElement('h4', 'reporting-review__subheading', 'Design-risk notes'));
    panel.append(createRiskList(group.designRisk, 'Needs UCD review'));
    return panel;
  }

  function createStatePanel(label, state) {
    const panel = createElement('section', 'reporting-review reporting-review--state');
    panel.dataset.reportingReviewLevel = 'state';
    panel.append(createElement('h4', 'reporting-review__heading', label + ' — state-specific review evidence'));
    panel.append(createElement('p', 'reporting-review__summary', 'Specific to this screenshot state. Shared grouping criteria and shared design risk are shown once at grouping level.'));
    panel.append(createElement('h5', 'reporting-review__subheading', 'Gherkin acceptance criteria'));
    panel.append(createPre(state.gherkin));
    panel.append(createElement('h5', 'reporting-review__subheading', 'Design-risk notes'));
    panel.append(createRiskList({ risk: state.risk }, 'Needs UCD review'));
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
          gherkin: 'Scenario: Review this state\\n  Then I should understand the ResearchOps task supported by this state',
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

.reporting-review__summary {
  margin-top: 0;
}

.reporting-review__pre {
  background: #ffffff;
  border: 1px solid #b1b4b6;
  overflow-x: auto;
  padding: 12px;
  white-space: pre-wrap;
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

function replaceStaleAcceptanceText(html, pageId, criteria) {
  const staleMarkers = {
    home: 'Choose a journey to explore',
    projects: 'Project list page acceptance criteria not yet generated',
  };
  const marker = staleMarkers[pageId];

  if (!marker || !html.includes(marker)) {
    return html;
  }

  return html.replace(new RegExp(marker, 'g'), criteria);
}

export function syncReportAcceptanceCriteria(reportDir = 'reports-site') {
  const reportPath = path.join(reportDir, 'index.html');
  const previousHtml = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '';
  let nextHtml = previousHtml;
  const results = [];

  for (const [pageId, criteria] of [
    ['home', buildHomeAcceptanceGherkin()],
    ['projects', buildProjectsAcceptanceGherkin()],
  ]) {
    const before = nextHtml;
    nextHtml = replaceStaleAcceptanceText(nextHtml, pageId, criteria);
    results.push({
      pageId,
      changed: before !== nextHtml,
      previousLength: before.length,
      nextLength: nextHtml.length,
    });
  }

  const beforeGrouping = nextHtml;
  nextHtml = applyReportingReviewGrouping(nextHtml);

  if (nextHtml !== previousHtml) {
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(reportPath, nextHtml, 'utf8');
  }

  return {
    changed: nextHtml !== previousHtml,
    results,
    previousLength: previousHtml.length,
    nextLength: nextHtml.length,
    groupingChanged: beforeGrouping !== nextHtml,
    groupingScriptApplied: true,
  };
}

function main() {
  const reportDir = process.argv[2] || 'reports-site';
  const result = syncReportAcceptanceCriteria(reportDir);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { HOME_ACCEPTANCE_GHERKIN, PROJECTS_ACCEPTANCE_GHERKIN, GROUP_REVIEW_MODEL };
