/* eslint-env node */

/**
 * @file visual-walkthrough.participant-consent-states.mjs
 * @summary State catalogue for the participant consent visual walkthrough.
 */

import {
	participantConsentForm,
	participantConsentMockRoutes,
	participantConsentPath,
	participantConsentParticipants,
} from './visual-walkthrough.participant-consent-fixtures.mjs';

export const participantConsentDefaultState = {
	id: 'default',
	title: 'Consent workspace loaded',
	description:
		'Participant consent loaded with study context, a published consent form, participants and existing consent records.',
	path: participantConsentPath,
	mockRoutes: participantConsentMockRoutes(),
	actions: [
		{
			type: 'waitForText',
			text: 'Participant consent loaded.',
		},
		{
			type: 'waitForText',
			text: participantConsentForm.title,
		},
		{
			type: 'waitForText',
			text: 'Ready for session',
		},
	],
};

export const participantConsentVisualStates = [
	{
		id: 'missing-context-error',
		title: 'Missing study context error state',
		description:
			'Participant consent loaded without project and study IDs; the page shows a blocking route-context message.',
		actions: [
			{
				type: 'waitForText',
				text: 'Open this page from a study',
			},
		],
	},
	{
		id: 'no-published-consent-form',
		title: 'No published consent form state',
		description:
			'The study has route context and participants, but no published consent form exists. The page routes the researcher to create consent forms before recording participant consent.',
		path: participantConsentPath,
		mockRoutes: participantConsentMockRoutes({ consentForms: [] }),
		actions: [
			{
				type: 'waitForText',
				text: 'Create and publish a consent form before recording participant consent',
			},
			{
				type: 'waitForText',
				text: 'Create consent forms',
			},
		],
	},
	{
		id: 'no-participants',
		title: 'No participants state',
		description:
			'The study has a published consent form, but no participants are available. The page routes the researcher to schedule participants before recording consent.',
		path: participantConsentPath,
		mockRoutes: participantConsentMockRoutes({
			participants: [],
			participantConsentRecords: [],
		}),
		actions: [
			{
				type: 'waitForText',
				text: 'Add participants before recording consent',
			},
			{
				type: 'waitForText',
				text: 'Schedule participants',
			},
		],
	},
	{
		id: 'participant-selected',
		title: 'Participant selected for consent review',
		description:
			'A researcher selects a participant with an existing consent record and can review required statements, optional permissions and withdrawal controls.',
		path: participantConsentPath,
		mockRoutes: participantConsentMockRoutes(),
		actions: [
			{
				type: 'click',
				selector: `[data-record-consent="${participantConsentParticipants[0].id}"]`,
			},
			{
				type: 'waitForText',
				text: `Review consent for ${participantConsentParticipants[0].display_name}`,
			},
			{
				type: 'waitForText',
				text: 'Record withdrawal or do not proceed',
			},
		],
	},
];
