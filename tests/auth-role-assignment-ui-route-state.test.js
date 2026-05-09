import assert from 'node:assert/strict';
import fs from 'node:fs';

const pageSource = fs.readFileSync('public/pages/team/role-assignments/index.html', 'utf8');
const scriptSource = fs.readFileSync('public/js/auth-role-assignment-page.js', 'utf8');
const styleSource = fs.readFileSync('public/css/auth-role-assignments.css', 'utf8');
const govukFrontendSource = fs.readFileSync('public/css/govuk/govuk-frontend-v6.css', 'utf8');

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
	assert.match(pageSource, /\/js\/auth-role-assignment-page\.js/);
	assert.match(pageSource, /\/css\/auth-role-assignments\.css/);
}

function assertTopLevelAdminInformationArchitecture() {
	const breadcrumbIndex = pageSource.indexOf('class="govuk-breadcrumbs"');
	const mainIndex = pageSource.indexOf('<main class="govuk-main-wrapper"');

	assert.match(pageSource, /govuk-breadcrumbs/);
	assert.ok(breadcrumbIndex > -1, 'Expected breadcrumb navigation to exist');
	assert.ok(mainIndex > -1, 'Expected main landmark to exist');
	assert.ok(breadcrumbIndex < mainIndex, 'Expected breadcrumb navigation to sit before main');
	assert.match(pageSource, />Home</);
	assert.match(pageSource, />Team administration</);
	assert.doesNotMatch(pageSource, /govuk-back-link/);
	assert.doesNotMatch(pageSource, /Back to projects/);
	assert.doesNotMatch(pageSource, /type="reset"/);
	assert.doesNotMatch(pageSource, /Clear form/);
}

function assertCurrentAccessPanelIsReducedToTeamScope() {
	assert.doesNotMatch(pageSource, /Your current access/);
	assert.match(pageSource, /Team scope/);
	assert.match(scriptSource, /You are assigning roles in/);
	assert.match(scriptSource, /You cannot assign roles/);
	assert.doesNotMatch(scriptSource, /Current roles:/);
}

function assertUserIdUsesDetailsWithoutExample() {
	assert.match(pageSource, /govuk-details__summary-text/);
	assert.match(pageSource, /Use a user ID instead/);
	assert.doesNotMatch(pageSource, /usr_bootstrap/);
	assert.doesNotMatch(pageSource, /For example, <code>/);
}

function assertRoleOptionsUseGOVUKRadios() {
	assert.doesNotMatch(pageSource, /<select class="govuk-select" id="role-key"/);
	assert.match(pageSource, /<div class="govuk-radios auth-role-assignment-radios" data-module="govuk-radios" aria-describedby="role-key-hint">/);
	assert.match(pageSource, /<input class="govuk-radios__input" id="role-key-observer" name="roleKey" type="radio" value="observer" \/>\s*<label class="govuk-label govuk-radios__label" for="role-key-observer">Observer<\/label>/);
	assert.match(pageSource, /<input class="govuk-radios__input" id="role-key-researcher" name="roleKey" type="radio" value="researcher" \/>\s*<label class="govuk-label govuk-radios__label" for="role-key-researcher">Researcher<\/label>/);
	assert.match(pageSource, /<input class="govuk-radios__input" id="role-key-research-lead" name="roleKey" type="radio" value="research_lead" \/>\s*<label class="govuk-label govuk-radios__label" for="role-key-research-lead">Research Lead<\/label>/);
	assert.match(pageSource, /<input class="govuk-radios__input" id="role-key-approver" name="roleKey" type="radio" value="approver" \/>\s*<label class="govuk-label govuk-radios__label" for="role-key-approver">Approver<\/label>/);
	assert.match(pageSource, /<input class="govuk-radios__input" id="role-key-safeguarding-lead" name="roleKey" type="radio" value="safeguarding_lead" \/>\s*<label class="govuk-label govuk-radios__label" for="role-key-safeguarding-lead">Safeguarding Lead<\/label>/);
	assert.match(pageSource, /<input class="govuk-radios__input" id="role-key-team-admin" name="roleKey" type="radio" value="team_admin" \/>\s*<label class="govuk-label govuk-radios__label" for="role-key-team-admin">Team Admin<\/label>/);
	assert.match(pageSource, /Start with the lowest role that gives the person what they need/);
}

function assertRoleRadiosDoNotRepeatAbilityCopy() {
	const roleSection = pageSource.slice(pageSource.indexOf('id="role-section-title"'), pageSource.indexOf('id="duration-section-title"'));

	assert.doesNotMatch(roleSection, /govuk-radios__hint/);
	assert.doesNotMatch(roleSection, /Can observe low-risk research context without seeing participant personal data/);
	assert.doesNotMatch(roleSection, /Can create and update governed research records/);
	assert.doesNotMatch(roleSection, /Can view, record, resolve and audit safeguarding concerns/);
	assert.doesNotMatch(roleSection, /Can manage team membership, role assignment and general audit oversight/);
	assert.doesNotMatch(scriptSource, /description:/);
	assert.doesNotMatch(scriptSource, /<h3 class="govuk-heading-s">/);
	assert.doesNotMatch(scriptSource, /This is a sensitive role/);
	assert.match(scriptSource, /This role can:/);
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
	assert.match(pageSource, /name="durationPreset" type="radio" value="30"/);
	assert.match(pageSource, /name="durationPreset" type="radio" value="60"/);
	assert.match(pageSource, /name="durationPreset" type="radio" value="90"/);
	assert.match(pageSource, /name="durationPreset" type="radio" value="180"/);
	assert.match(pageSource, /name="durationPreset" type="radio" value="custom"/);
	assert.match(pageSource, /Access ends at the end of the selected day/);
	assert.match(scriptSource, /const DURATION_LABELS = Object\.freeze/);
	assert.match(scriptSource, /expiresAtFor/);
}

function assertClientUsesAuthAndAssignmentEndpoints() {
	assert.match(scriptSource, /API_BASE: document\.documentElement\?\.dataset\?\.apiOrigin \|\| window\.API_ORIGIN \|\| ""/);
	assert.doesNotMatch(scriptSource, /https:\/\/rops-api\.digikev-kevin-rapley\.workers\.dev/);
	assert.match(scriptSource, /credentials: "include"/);
	assert.match(scriptSource, /fetchJson\("\/api\/me"\)/);
	assert.match(scriptSource, /fetchJson\("\/api\/auth\/role-assignments"/);
	assert.match(scriptSource, /permissions\.has\("role\.assign"\)/);
	assert.match(scriptSource, /setDisabled\(!canAssignRoles\)/);
}

function assertClientBuildsCorrectRequestContract() {
	assert.match(scriptSource, /targetEmail/);
	assert.match(scriptSource, /targetUserId/);
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
	assert.doesNotMatch(scriptSource, /team\.manage/);
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

function assertStylesExist() {
	assert.match(styleSource, /\.auth-role-assignment-scope__panel/);
	assert.match(styleSource, /width-two-thirds/);
	assert.match(styleSource, /width-one-half/);
	assert.match(styleSource, /govuk-details__summary::before/);
	assert.match(styleSource, /\.auth-role-assignment-radios/);
	assert.match(styleSource, /\.auth-role-assignment-custom-date/);
	assert.match(styleSource, /govuk-warning-text/);
	assert.match(styleSource, /govuk-summary-list/);
	assert.match(styleSource, /\.auth-role-assignment-result--success/);
	assert.match(styleSource, /\.auth-role-assignment-result--error/);
	assert.match(styleSource, /transparency begins in the cascade/);
}

assertPageStructure();
assertTopLevelAdminInformationArchitecture();
assertCurrentAccessPanelIsReducedToTeamScope();
assertUserIdUsesDetailsWithoutExample();
assertRoleOptionsUseGOVUKRadios();
assertRoleRadiosDoNotRepeatAbilityCopy();
assertPageStylesDoNotRecreateGOVUKRadioInternals();
assertDurationModelUsesGovernedPresets();
assertClientUsesAuthAndAssignmentEndpoints();
assertClientBuildsCorrectRequestContract();
assertClientValidatesBeforeReview();
assertNoPostBeforeConfirm();
assertRoleAbilitiesArePlainLanguage();
assertGOVUKComponentMarkup();
assertStylesExist();
