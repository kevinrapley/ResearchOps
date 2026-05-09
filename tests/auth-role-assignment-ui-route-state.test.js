import assert from 'node:assert/strict';
import fs from 'node:fs';

const pageSource = fs.readFileSync('public/pages/team/role-assignments/index.html', 'utf8');
const scriptSource = fs.readFileSync('public/js/auth-role-assignment-page.js', 'utf8');
const styleSource = fs.readFileSync('public/css/auth-role-assignments.css', 'utf8');

function assertPageStructure() {
	assert.match(pageSource, /<title>Assign a role to a team member — ResearchOps Demo Suite<\/title>/);
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

function assertCurrentAccessPanelIsReducedToTeamScope() {
	assert.doesNotMatch(pageSource, /Your current access/);
	assert.match(pageSource, /Team scope/);
	assert.match(scriptSource, /You are assigning roles in/);
	assert.match(scriptSource, /You cannot assign roles/);
	assert.doesNotMatch(scriptSource, /Current roles:/);
}

function assertRoleOptionsUseRadios() {
	assert.doesNotMatch(pageSource, /<select class="govuk-select" id="role-key"/);
	assert.match(pageSource, /name="roleKey" type="radio" value="observer"/);
	assert.match(pageSource, /name="roleKey" type="radio" value="researcher"/);
	assert.match(pageSource, /name="roleKey" type="radio" value="research_lead"/);
	assert.match(pageSource, /name="roleKey" type="radio" value="approver"/);
	assert.match(pageSource, /name="roleKey" type="radio" value="safeguarding_lead"/);
	assert.match(pageSource, /name="roleKey" type="radio" value="team_admin"/);
	assert.match(pageSource, /Start with the lowest role that gives the person what they need/);
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
	assert.match(scriptSource, /Enter a team member’s email address or user ID/);
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

function assertRoleMetadataIsVisibleClientSide() {
	assert.match(scriptSource, /const ROLE_DETAILS = Object\.freeze/);
	assert.match(scriptSource, /governed\.create/);
	assert.match(scriptSource, /governed\.edit/);
	assert.match(scriptSource, /governed\.review/);
	assert.match(scriptSource, /governed\.approve/);
	assert.match(scriptSource, /recommendation\.own/);
	assert.match(scriptSource, /safeguarding\.view/);
	assert.match(scriptSource, /safeguarding\.audit\.view/);
	assert.match(scriptSource, /team\.manage/);
	assert.match(scriptSource, /role\.assign/);
}

function assertStylesExist() {
	assert.match(styleSource, /\.auth-role-assignment-scope__panel/);
	assert.match(styleSource, /\.auth-role-assignment-input--email/);
	assert.match(styleSource, /width: 66\.66%/);
	assert.match(styleSource, /\.auth-role-assignment-input--user-id/);
	assert.match(styleSource, /width: 50%/);
	assert.match(styleSource, /\.auth-role-assignment-radios/);
	assert.match(styleSource, /\.auth-role-assignment-custom-date/);
	assert.match(styleSource, /\.auth-role-assignment-sensitive/);
	assert.match(styleSource, /\.auth-role-assignment-review/);
	assert.match(styleSource, /\.auth-role-assignment-result--success/);
	assert.match(styleSource, /\.auth-role-assignment-result--error/);
	assert.match(styleSource, /transparency begins in the cascade/);
}

assertPageStructure();
assertCurrentAccessPanelIsReducedToTeamScope();
assertRoleOptionsUseRadios();
assertDurationModelUsesGovernedPresets();
assertClientUsesAuthAndAssignmentEndpoints();
assertClientBuildsCorrectRequestContract();
assertClientValidatesBeforeReview();
assertNoPostBeforeConfirm();
assertRoleMetadataIsVisibleClientSide();
assertStylesExist();
