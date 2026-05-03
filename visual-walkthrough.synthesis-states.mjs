/* eslint-env node */

/**
 * @file visual-walkthrough.synthesis-states.mjs
 * @summary State catalogue for the study synthesis visual walkthrough.
 */

import {
	clusterCreateMockRoute,
	clusterUpdateMockRoute,
	synthesisClusterWithEvidence,
	synthesisEmptyCluster,
	synthesisEvidence,
	synthesisMockRoutes,
	synthesisPath,
	synthesisTheme,
	themeCreateMockRoute,
} from './visual-walkthrough.synthesis-fixtures.mjs';

export const synthesisDefaultState = {
	id: 'missing-sid-error',
	title: 'Missing study ID error state',
	description:
		'Synthesis loaded without a study ID; the page shows the blocking route-context error.',
};

export const synthesisVisualStates = [
	{
		id: 'empty-evidence',
		title: 'Empty evidence state',
		description:
			'Study synthesis loaded with valid study context but no captured evidence notes. The page routes the researcher to evidence capture rather than showing synthesis controls.',
		path: synthesisPath,
		mockRoutes: synthesisMockRoutes({ evidence: [] }),
		actions: [
			{
				type: 'waitForText',
				text: 'Capture evidence before starting synthesis',
			},
			{
				type: 'waitForText',
				text: 'Capture evidence in a session',
			},
		],
	},
	{
		id: 'evidence-loaded',
		title: 'Evidence available before working clusters',
		description:
			'Study synthesis with realistic evidence available. The first available task is creating a working cluster grouping; evidence selection remains hidden until a cluster exists.',
		path: synthesisPath,
		mockRoutes: synthesisMockRoutes(),
		actions: [
			{
				type: 'waitForText',
				text: 'Create a working cluster grouping before selecting evidence.',
			},
		],
	},
	{
		id: 'working-cluster-created',
		title: 'Working cluster grouping created',
		description:
			'A researcher creates a provisional working cluster grouping before adding evidence. Evidence selection becomes available only after the cluster exists.',
		path: synthesisPath,
		mockRoutes: synthesisMockRoutes({ extraRoutes: [clusterCreateMockRoute()] }),
		actions: [
			{
				type: 'fill',
				selector: '#cluster-label',
				value: synthesisEmptyCluster.label,
			},
			{
				type: 'fill',
				selector: '#cluster-description',
				value: synthesisEmptyCluster.description,
			},
			{
				type: 'click',
				selector: '#create-cluster',
			},
			{
				type: 'waitForText',
				text: `Created working cluster grouping ${synthesisEmptyCluster.label}.`,
			},
			{
				type: 'waitForText',
				text: synthesisEvidence[0].excerpt,
			},
		],
	},
	{
		id: 'evidence-added-to-cluster',
		title: 'Evidence added to working cluster grouping',
		description:
			'A researcher selects two evidence notes and adds them to an existing working cluster grouping. Theme creation becomes available after evidence is grouped.',
		path: synthesisPath,
		mockRoutes: synthesisMockRoutes({
			clusters: [synthesisEmptyCluster],
			extraRoutes: [clusterUpdateMockRoute()],
		}),
		actions: [
			{
				type: 'check',
				selector: '#evidence-ev-confidence-before-start',
			},
			{
				type: 'check',
				selector: '#evidence-ev-language-support',
			},
			{
				type: 'select',
				selector: '#target-cluster',
				value: synthesisEmptyCluster.id,
			},
			{
				type: 'click',
				selector: '#add-selected-evidence',
			},
			{
				type: 'waitForText',
				text: `Added 2 evidence items to ${synthesisEmptyCluster.label}.`,
			},
		],
	},
	{
		id: 'theme-blocked-without-evidence',
		title: 'Theme creation hidden before evidence is grouped',
		description:
			'Theme creation remains hidden until at least one working cluster grouping contains source evidence.',
		path: synthesisPath,
		mockRoutes: synthesisMockRoutes({ clusters: [synthesisEmptyCluster] }),
		actions: [
			{
				type: 'waitForSelector',
				selector: `[data-cluster-id="${synthesisEmptyCluster.id}"]`,
			},
			{
				type: 'waitForText',
				text: 'Add evidence to a working cluster grouping before creating a theme.',
			},
		],
	},
	{
		id: 'theme-created',
		title: 'Theme created with evidence traceability',
		description:
			'A theme is created from a populated cluster and the source evidence IDs remain inspectable.',
		path: synthesisPath,
		mockRoutes: synthesisMockRoutes({
			clusters: [synthesisClusterWithEvidence],
			extraRoutes: [themeCreateMockRoute()],
		}),
		actions: [
			{
				type: 'select',
				selector: '#theme-cluster',
				value: synthesisEmptyCluster.id,
			},
			{
				type: 'fill',
				selector: '#theme-label',
				value: synthesisTheme.label,
			},
			{
				type: 'fill',
				selector: '#theme-description',
				value: synthesisTheme.description,
			},
			{
				type: 'click',
				selector: '#create-theme',
			},
			{
				type: 'waitForText',
				text: `Created theme ${synthesisTheme.label}.`,
			},
			{
				type: 'click',
				selector: '.theme-card .govuk-details__summary',
			},
		],
	},
];
