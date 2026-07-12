import assert from 'node:assert/strict';
import fs from 'node:fs';

const pageSource = fs.readFileSync('public/pages/team/role-assignments/index.html', 'utf8');
const scriptSource = fs.readFileSync('public/js/auth-role-assignment-page.js', 'utf8');
const styleSource = fs.readFileSync('public/css/auth-role-assignments.css', 'utf8');
const styleScssSource = fs.readFileSync('src/styles/auth-role-assignments.scss', 'utf8');
const govukFrontendSource = fs.readFileSync('public/css/govuk/govuk-frontend-v6.css', 'utf8');
const generatedCssTargetsSource = fs.readFileSync('scripts/styles/generated-css-targets.mjs', 'utf8');
const rendererSource = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');
const templateSource = fs.readFileSync('src/govuk/templates/pages/role-assignments.njk', 'utf8');
const normalizedPageText = pageSource.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertRadioOption(id, name, value, label) {
	assert.match(
		pageSource,
		new RegExp(
			`<input\\s+class="govuk-radios__input"\\s+id="${id}"\\s+name="${name}"\\s+type="radio"\\s+value="${value}"\\s*/>\\s*<label\\s+class="govuk-label govuk-radios__label"\\s+for="${id}"\\s*>\\s*${escapeRegExp(label)}\\s*</label\\s*>`,
		),
	);
}

function assertPageStructure() {
	assert.match(pageSource, /<title>Assign a role to a team member [-—] ResearchOps Demo Suite<\/title>/);
	assert.match(pageSource, /id="role-assignment-title"/);
	assert.match(pageSource, /Assign a role to a team member/);
	assert.match(pageSource, /id="auth-context"/);
	assert.match(pageSource, /id="role-assignment-error-summary"/);
	assert.match(pageSource, /id="role-assignment-form"/);
	assert.match(pageSource, /id="target-email"/);
	assert.match(pageSource, /id="target-user-id-details"/);
	assert.match(pageSource, /id="target-user-id"/);
	assert.match(pageSource, /id="team-action-existing"/);
	assert.match(pageSource, /id="team-action-create"/);
	assert.match(pageSource, /id="team-id-options"/);
	assert.match(pageSource, /id="new-team-name"/);
	assert.match(pageSource, /id="new-team-reason"/);
	assert.match(pageSource, /id="role-key-observer"/);
	assert.match(pageSource, /id="duration-30"/);
	assert.match(pageSource, /id="duration-custom"/);
	assert.match(pageSource, /id="custom-expiry-date-group"/);
	assert.match(pageSource, /id="expiry-day"/);
	assert.match(pageSource, /id="requested-reason"/);
	assert.match(pageSource, /id="sensitive-role-confirmation"/);
	assert.match(pageSource, /id="safeguarding-confirmation"/);
	assert.match(pageSource, /id="role-assignment-review"/);
	assert.match(pageSource, /id="confirm-role-assignment"/);
	assert.match(pageSource, /Confirm and assign role/);
	assert.match(pageSource, /id="role-assignment-result"/);
	assert.match(pageSource, /\/js\/auth-role-assignment-page\.js\?v=hide-internal-codes-20260615/);
	assert.match(pageSource, /\/css\/auth-role-assignments\.css/);
}

function assertTopLevelAdminInformationArchitecture() {
	const breadcrumbIndex = pageSource.indexOf('class="govuk-breadcrumbs"');
	const mainIndex = pageSource.indexOf('<main class="govuk-main-wrapper"');

	assert.match(pageSource, /govuk-breadcrumbs/);
	assert.ok(breadcrumbIndex > -1, 'Expected breadcrumb navigation to exist');
	assert.ok(mainIndex > -1, 'Expected main landmark to exist');
	assert.ok(breadcrumbIndex > mainIndex, 'Expected breadcrumb navigation to sit inside main');
	assert.match(
		pageSource,
		/<a class="govuk-breadcrumbs__link" href="\/">Home<\/a>[\s\S]*?<a class="govuk-breadcrumbs__link" href="\/pages\/account\/">Your account<\/a>[\s\S]*?>Team administration</,
	);
	assert.match(pageSource, />Team administration</);
	assert.doesNotMatch(pageSource, /govuk-back-link/);
	assert.doesNotMatch(pageSource, /Back to projects/);
	assert.doesNotMatch(pageSource, /type="reset"/);
	assert.doesNotMatch(pageSource, /Clear form/);
}

function assertUsesFullGOVUKFrontendTemplate() {
	assert.match(pageSource, /<html class="govuk-template" lang="en">/);
	assert.match(pageSource, /<body class="govuk-template__body" data-flux-page="page\.(?:unknown|team-role-assignments)">/);
	assert.match(pageSource, /\/assets\/govuk\/govuk-frontend\.css/);
	assert.match(pageSource, /\/components\/layout\.js/);
	assert.match(pageSource, /\/js\/govuk-frontend-init\.js/);
	assert.match(pageSource, /<x-include src="\/partials\/header\.html"/);
	assert.match(pageSource, /<x-include src="\/partials\/footer\.html(?:\?[^"]*)?"/);
	assert.doesNotMatch(pageSource, /\/css\/govuk\/govuk-typography\.css/);
	assert.doesNotMatch(pageSource, /\/css\/govuk\/govuk-colours\.css/);
	assert.doesNotMatch(pageSource, /\/css\/govuk\/govuk-page-chrome\.css/);
	assert.doesNotMatch(pageSource, /\/css\/govuk\/govuk-buttons\.css/);
	assert.doesNotMatch(pageSource, /\/css\/govuk\/govuk-forms\.css/);
	assert.doesNotMatch(pageSource, /\/css\/govuk\/govuk-frontend-v6\.css/);
	assert.doesNotMatch(pageSource, /\/css\/screen\.css/);
}

function assertRoleAssignmentPageIsGeneratedFromNunjucks() {
	assert.match(rendererSource, /template: 'pages\/role-assignments\.njk'/);
	assert.match(rendererSource, /output: 'public\/pages\/team\/role-assignments\/index\.html'/);
	assert.match(rendererSource, /route: '\/pages\/team\/role-assignments\/'/);
	assert.match(rendererSource, /condition: 'permission-model-change'/);
	assert.match(templateSource, /{% extends "layouts\/researchops\.njk" %}/);
	assert.match(templateSource, /macros\/sourcebook-gate\.njk/);
	assert.match(templateSource, /SourcebookGate\(sourcebookGate\)/);
	assert.match(templateSource, /macros\/sourcebook-context\.njk/);
	assert.match(templateSource, /SourcebookContext\(sourcebookContext\)/);
	assert.match(templateSource, /macros\/sourcebook-evidence-ledger\.njk/);
	assert.match(templateSource, /SourcebookEvidenceLedger\(sourcebookEvidenceLedger\)/);
	assert.match(templateSource, /{% block head %}/);
	assert.match(templateSource, /\/css\/auth-role-assignments\.css/);
	assert.match(templateSource, /{% block content %}/);
	assert.match(templateSource, /id="role-assignment-form"/);
	assert.match(templateSource, /{% block scripts %}/);
	assert.match(templateSource, /\/js\/auth-role-assignment-page\.js\?v=hide-internal-codes-20260615/);
	assert.doesNotMatch(templateSource, /<html class="govuk-template"/);
	assert.doesNotMatch(templateSource, /<x-include src="\/partials\/header\.html"/);
	assert.doesNotMatch(templateSource, /<x-include src="\/partials\/footer\.html"/);
}

function assertRoleAssignmentStylesAreGeneratedFromSass() {
	assert.match(generatedCssTargetsSource, /source: 'src\/styles\/auth-role-assignments\.scss'/);
	assert.match(generatedCssTargetsSource, /output: 'public\/css\/auth-role-assignments\.css'/);
	assert.match(styleScssSource, /Repo:\s+\/src\/styles\/auth-role-assignments\.scss/);
	assert.match(styleScssSource, /@use ['"]sourcebook-context['"];/);
	assert.match(styleSource, /Repo:\s+\/src\/styles\/auth-role-assignments\.scss/);
}

function assertSourcebookContextIsShown() {
	assert.match(pageSource, /class="sourcebook-gate sourcebook-gate--blocked"/);
	assert.match(pageSource, /Sourcebook gate for role assignment/);
	assert.match(pageSource, /Evidence needed/);
	assert.match(pageSource, /Add evidence before continuing/);
	assert.match(pageSource, /class="sourcebook-context"/);
	assert.match(pageSource, /Sourcebook context for role assignment/);
	assert.match(pageSource, /INFRA-PROV 3\.1\.1/);
	assert.match(pageSource, /Control access by role and research need/);
	assert.match(pageSource, /\/pages\/sourcebook\/tools-and-infrastructure\/#infra-prov-3-1-1/);
	assert.match(pageSource, /Permission model change/);
	assert.match(pageSource, /class="sourcebook-evidence-ledger"/);
	assert.match(pageSource, /Evidence ledger for role assignment/);
	assert.match(pageSource, /Access Request/);
	assert.match(pageSource, /access-request/);
	assert.match(pageSource, /Role Permission Model/);
	assert.match(pageSource, /role-permission-model/);
	assert.match(pageSource, /Needed/);
	assert.match(styleSource, /\.sourcebook-gate/);
	assert.match(styleSource, /\.sourcebook-context/);
	assert.match(styleSource, /\.sourcebook-evidence-ledger/);
}

function assertCurrentAccessPanelIsReducedToTeamScope() {
	assert.doesNotMatch(pageSource, /Your current access/);
	assert.match(pageSource, /Team scope/);
	assert.match(scriptSource, /You can assign roles in teams you manage/);
	assert.match(scriptSource, /Your current team is/);
	assert.match(scriptSource, /You can also create a new team as part of this role assignment/);
	assert.match(scriptSource, /You cannot assign roles/);
	assert.doesNotMatch(scriptSource, /Current roles:/);
}

function assertExplicitTeamChoiceExists() {
	assert.match(pageSource, /Which team should this role be in\?/);
	assert.match(pageSource, /Use an existing team/);
	assert.match(pageSource, /Create a new team/);
	assert.match(pageSource, /You will become Team Admin for the new team/);
	assert.match(pageSource, /The person will be added to this team if they are not already a\s+member/);
	assert.match(scriptSource, /teamOptions: document\.getElementById\("team-id-options"\)/);
	assert.match(scriptSource, /existingTeamPanel: document\.getElementById\("existing-team-panel"\)/);
	assert.match(scriptSource, /newTeamPanel: document\.getElementById\("new-team-panel"\)/);
	assert.match(scriptSource, /function selectedTeamAction\(\)/);
	assert.match(scriptSource, /function isCreatingTeam\(\)/);
	assert.match(scriptSource, /function selectedTeamId\(\)/);
	assert.match(scriptSource, /input\[name="teamId"\]:checked/);
	assert.match(scriptSource, /function selectedTeam\(context = state\.context\)/);
	assert.match(scriptSource, /function renderTeamActionControls\(\)/);
	assert.match(scriptSource, /function renderTeamOptions\(context\)/);
	assert.match(scriptSource, /teamAction: selectedTeamAction\(\)/);
	assert.match(scriptSource, /teamId: selectedTeamId\(\)/);
	assert.match(scriptSource, /newTeamName/);
	assert.match(scriptSource, /newTeamReason/);
	assert.match(scriptSource, /Select which team this role should be in/);
	assert.match(scriptSource, /Enter the new team's name/);
}

function assertMembershipCreationCopyExists() {
	assert.match(pageSource, /give someone access to a role in a ResearchOps team you manage/);
	assert.ok(
		normalizedPageText.includes('ResearchOps will add them when you assign the role'),
		'Expected membership creation copy to explain the person is added when the role is assigned',
	);
	assert.ok(
		normalizedPageText.includes('If you create a new team, ResearchOps will make you Team Admin for that team'),
		'Expected review copy to explain the assigner becomes Team Admin for a new team',
	);
	assert.match(scriptSource, /They were also added as an active member of this team/);
	assert.match(scriptSource, /teamMembership/);
	assert.match(scriptSource, /createdOrReactivated/);
}

function assertUserIdUsesDetailsWithoutExample() {
	assert.match(pageSource, /govuk-details__summary-text/);
	assert.match(pageSource, /Use a user ID instead/);
	assert.doesNotMatch(pageSource, /usr_bootstrap/);
	assert.doesNotMatch(pageSource, /For example, <code>/);
}

function assertRoleOptionsUseGOVUKRadios() {
	assert.doesNotMatch(pageSource, /<select class="govuk-select" id="role-key"/);
	assert.match(
		pageSource,
		/class="govuk-radios auth-role-assignment-radios"[\s\S]*?data-module="govuk-radios"[\s\S]*?aria-describedby="role-key-hint"/,
	);
	assertRadioOption('role-key-observer', 'roleKey', 'observer', 'Observer');
	assertRadioOption('role-key-researcher', 'roleKey', 'researcher', 'Researcher');
	assertRadioOption('role-key-research-lead', 'roleKey', 'research_lead', 'Research Lead');
	assertRadioOption('role-key-approver', 'roleKey', 'approver', 'Approver');
	assertRadioOption('role-key-safeguarding-lead', 'roleKey', 'safeguarding_lead', 'Safeguarding Lead');
	assertRadioOption('role-key-team-admin', 'roleKey', 'team_admin', 'Team Admin');
	assert.match(pageSource, /Start with the lowest role that gives the person what they need/);
}

function assertRoleRadioHintsAreUsefulAndClickable() {
	const roleSection = pageSource.slice(pageSource.indexOf('id="role-section-title"'), pageSource.indexOf('id="duration-section-title"'));

	assert.match(roleSection, /govuk-radios__hint/);
	assert.match(roleSection, /Can observe low-risk research context without seeing participant personal data/);
	assert.match(roleSection, /Can create and update governed research records/);
	assert.match(roleSection, /Can create, update and review governed research records/);
	assert.match(roleSection, /Can review and approve governed research records/);
	assert.match(roleSection, /Can view, record, resolve and audit safeguarding concerns/);
	assert.match(roleSection, /Can manage team membership, role assignment and general audit oversight/);
	assert.match(scriptSource, /function makeRadioHintSelectable\(event\)/);
	assert.match(scriptSource, /event\.target\.closest\("\.auth-role-assignment-radios \.govuk-radios__hint"\)/);
	assert.match(scriptSource, /input\.checked = true/);
	assert.match(scriptSource, /input\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
	assert.match(scriptSource, /hint\.dataset\.clicksRadio = "true"/);
	assert.match(scriptSource, /dom\.form\.addEventListener\("click", makeRadioHintSelectable\)/);
}

function assertSelectedRoleSummaryUsesAbilityListOnly() {
	assert.doesNotMatch(scriptSource, /description:/);
	assert.doesNotMatch(scriptSource, /<h3 class="govuk-heading-s">/);
	assert.doesNotMatch(scriptSource, /This is a sensitive role/);
	assert.match(scriptSource, /This role can:/);
	assert.match(scriptSource, /auth-role-assignment-summary__abilities/);
}

function assertPageStylesDoNotRecreateGOVUKRadioInternals() {
	assert.match(govukFrontendSource, /\.govuk-radios__item/);
	assert.match(govukFrontendSource, /\.govuk-radios__input/);
	assert.match(govukFrontendSource, /\.govuk-radios__label::before/);
	assert.match(govukFrontendSource, /\.govuk-radios__input:checked \+ \.govuk-radios__label::after/);
	assert.doesNotMatch(styleSource, /\.auth-role-assignment-radios \.govuk-radios__item/);
	assert.doesNotMatch(styleSource, /\.auth-role-assignment-radios \.govuk-radios__input/);
	assert.doesNotMatch(styleSource, /\.auth-role-assignment-radios \.govuk-radios__label::before/);
	assert.doesNotMatch(styleSource, /\.auth-role-assignment-radios \.govuk-radios__label::after/);
}

function assertDurationModelUsesGovernedPresets() {
	assert.doesNotMatch(pageSource, /type="datetime-local"/);
	assert.match(pageSource, /How long should this role last\?/);
	assertRadioOption('duration-30', 'durationPreset', '30', '30 days');
	assertRadioOption('duration-60', 'durationPreset', '60', '60 days');
	assertRadioOption('duration-90', 'durationPreset', '90', '90 days');
	assertRadioOption('duration-180', 'durationPreset', '180', '180 days');
	assertRadioOption('duration-custom', 'durationPreset', 'custom', 'Until a specific date');
	assert.match(pageSource, /Access ends at the end of the selected day/);
	assert.match(scriptSource, /const DURATION_LABELS = Object\.freeze/);
	assert.match(scriptSource, /expiresAtFor/);
}

function assertClientUsesAuthAndAssignmentEndpoints() {
	assert.match(scriptSource, /function defaultApiOrigin\(\)/);
	assert.match(scriptSource, /configuredApiOrigin/);
	assert.match(scriptSource, /function apiBaseCandidates\(\)/);
	assert.match(scriptSource, /shouldUseFallbackApiOrigin/);
	assert.match(scriptSource, /rops-api-passwordless-preview/);
	assert.match(scriptSource, /credentials: "include"/);
	assert.match(scriptSource, /fetchJson\("\/api\/me"\)/);
	assert.match(scriptSource, /fetchJson\("\/api\/auth\/role-assignments"/);
	assert.match(scriptSource, /permissions\.has\("role\.assign"\)/);
	assert.match(scriptSource, /setDisabled\(!canAssignRoles\)/);
}

function assertClientSupportsPrefillFromRegistrationRequest() {
	assert.match(scriptSource, /function applyQueryPrefill\(\)/);
	assert.match(scriptSource, /params\.get\("targetEmail"\)/);
	assert.match(scriptSource, /params\.get\("targetUserId"\)/);
	assert.match(scriptSource, /params\.get\("requestedReason"\)/);
	assert.match(scriptSource, /params\.get\("roleKey"\)/);
	assert.match(scriptSource, /document\.getElementById\("target-email"\)\.value = prefill\.targetEmail/);
	assert.match(scriptSource, /document\.getElementById\("requested-reason"\)\.value = prefill\.requestedReason/);
	assert.match(scriptSource, /applyQueryPrefill\(\)/);
}

function assertClientBuildsCorrectRequestContract() {
	assert.match(scriptSource, /targetEmail/);
	assert.match(scriptSource, /targetUserId/);
	assert.match(scriptSource, /teamAction/);
	assert.match(scriptSource, /teamId/);
	assert.match(scriptSource, /newTeamName/);
	assert.match(scriptSource, /newTeamReason/);
	assert.match(scriptSource, /roleKey/);
	assert.match(scriptSource, /requestedReason/);
	assert.match(scriptSource, /expiresAt/);
	assert.match(scriptSource, /sensitiveRoleConfirmation/);
	assert.match(scriptSource, /ASSIGN_SENSITIVE_ROLE/);
	assert.match(scriptSource, /safeguardingConfirmation/);
	assert.match(scriptSource, /ASSIGN_SAFEGUARDING_LEAD/);
}

function assertClientValidatesBeforeReview() {
	assert.match(scriptSource, /function validate\(values\)/);
	assert.match(scriptSource, /Enter a team member's email address or user ID/);
	assert.match(scriptSource, /Select whether to use an existing team or create a new team/);
	assert.match(scriptSource, /Select which team this role should be in/);
	assert.match(scriptSource, /Enter the new team's name/);
	assert.match(scriptSource, /Select the role they need/);
	assert.match(scriptSource, /Select how long this role should last/);
	assert.match(scriptSource, /Enter a real expiry date/);
	assert.match(scriptSource, /Enter why you are assigning this role/);
	assert.match(scriptSource, /Confirm this sensitive role assignment is intentional/);
	assert.match(scriptSource, /Confirm Safeguarding Lead access is required/);
}

function assertNoPostBeforeConfirm() {
	assert.match(scriptSource, /function prepareReview\(event\)/);
	assert.match(scriptSource, /function renderReview\(values\)/);
	assert.match(scriptSource, /async function submitAssignment\(\)/);
	assert.match(scriptSource, /dom\.form\.addEventListener\("submit", prepareReview\)/);
	assert.match(scriptSource, /dom\.confirm\?\.addEventListener\("click", submitAssignment\)/);
}

function assertRoleAbilitiesArePlainLanguage() {
	assert.match(scriptSource, /abilities/);
	assert.match(scriptSource, /View restricted safeguarding details/);
	assert.match(scriptSource, /Record safeguarding observations/);
	assert.match(scriptSource, /Resolve safeguarding concerns/);
	assert.match(scriptSource, /View safeguarding audit events/);
	assert.match(scriptSource, /Manage team members and team settings/);
	assert.match(scriptSource, /Assign roles/);
	assert.match(scriptSource, /View general audit events/);
	assert.doesNotMatch(scriptSource, /governed\.create/);
	assert.doesNotMatch(scriptSource, /governed\.edit/);
	assert.doesNotMatch(scriptSource, /governed\.review/);
	assert.doesNotMatch(scriptSource, /governed\.approve/);
	assert.doesNotMatch(scriptSource, /recommendation\.own/);
	assert.doesNotMatch(scriptSource, /safeguarding\.view/);
	assert.doesNotMatch(scriptSource, /safeguarding\.audit\.view/);
	assert.doesNotMatch(pageSource, /governed\.create/);
	assert.doesNotMatch(pageSource, /safeguarding\.view/);
}

function assertGOVUKComponentMarkup() {
	assert.match(pageSource, /govuk-warning-text/);
	assert.match(pageSource, /govuk-checkboxes/);
	assert.match(scriptSource, /govuk-summary-list/);
	assert.match(scriptSource, /govuk-summary-list__row/);
	assert.match(scriptSource, /govuk-summary-list__actions/);
}

function assertSummaryListLayoutComesFromGOVUKFrontend() {
	assert.match(govukFrontendSource, /\.govuk-summary-list\s*\{/);
	assert.match(govukFrontendSource, /\.govuk-summary-list__row\s*\{/);
	assert.doesNotMatch(styleScssSource, /\.govuk-summary-list\s*\{/);
	assert.doesNotMatch(styleScssSource, /\.govuk-summary-list__row\s*\{/);
	assert.doesNotMatch(styleScssSource, /\.govuk-summary-list__key\s*\{/);
	assert.doesNotMatch(styleScssSource, /\.govuk-summary-list__value/);
	assert.doesNotMatch(styleScssSource, /\.govuk-summary-list__actions\s*\{/);
	assert.doesNotMatch(styleSource, /\.govuk-summary-list\s*\{/);
	assert.doesNotMatch(styleSource, /\.govuk-summary-list__row\s*\{/);
	assert.doesNotMatch(styleSource, /\.govuk-summary-list__key\s*\{/);
	assert.doesNotMatch(styleSource, /\.govuk-summary-list__value/);
	assert.doesNotMatch(styleSource, /\.govuk-summary-list__actions\s*\{/);
	assert.doesNotMatch(styleSource, /grid-template-columns:\s*minmax\(160px,\s*1fr\)\s*2fr\s*auto/);
}

function assertStylesExist() {
	assert.match(styleSource, /\.auth-role-assignment-scope__panel/);
	assert.match(styleSource, /width-two-thirds/);
	assert.match(styleSource, /width-one-half/);
	assert.match(styleSource, /govuk-details__summary::before/);
	assert.match(styleSource, /\.auth-role-assignment-radios/);
	assert.match(styleSource, /\.auth-role-assignment-team-panel/);
	assert.match(styleSource, /\.auth-role-assignment-custom-date/);
	assert.match(styleSource, /govuk-warning-text/);
	assert.match(styleSource, /\.auth-role-assignment-result--success/);
	assert.match(styleSource, /\.auth-role-assignment-result--error/);
	assert.match(styleSource, /transparency begins in the cascade/);
}

assertPageStructure();
assertTopLevelAdminInformationArchitecture();
assertUsesFullGOVUKFrontendTemplate();
assertRoleAssignmentPageIsGeneratedFromNunjucks();
assertRoleAssignmentStylesAreGeneratedFromSass();
assertSourcebookContextIsShown();
assertCurrentAccessPanelIsReducedToTeamScope();
assertExplicitTeamChoiceExists();
assertMembershipCreationCopyExists();
assertUserIdUsesDetailsWithoutExample();
assertRoleOptionsUseGOVUKRadios();
assertRoleRadioHintsAreUsefulAndClickable();
assertSelectedRoleSummaryUsesAbilityListOnly();
assertPageStylesDoNotRecreateGOVUKRadioInternals();
assertDurationModelUsesGovernedPresets();
assertClientUsesAuthAndAssignmentEndpoints();
assertClientSupportsPrefillFromRegistrationRequest();
assertClientBuildsCorrectRequestContract();
assertClientValidatesBeforeReview();
assertNoPostBeforeConfirm();
assertRoleAbilitiesArePlainLanguage();
assertGOVUKComponentMarkup();
assertSummaryListLayoutComesFromGOVUKFrontend();
assertStylesExist();
