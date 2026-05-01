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
	description: 'Synthesis loaded without a study ID; the page shows the blocking route-context error.',
};

export const synthesisVisualStates = [
	{
		id: 'empty-evidence',
		title: 'Empty evidence state',
		description: 'Study synthesis loaded with valid study context but no captured evidence notes.',
		path: synthesisPath,
		mockRoutes: synthesisMockRoutes({ evidence: [] }),
		actions: [
			{
				type: 'waitForText',
				text: 'No evidence has been captured for this study yet',
			},
		],
	},
	{
		id: 'evidence-loaded',
		title: 'Evidence loaded state',
		description: 'Study synthesis with realistic evidence notes loaded from mocked session evidence.',
		path: synthesisPath,
		mockRoutes: synthesisMockRoutes(),
		actions: [
			{
				type: 'waitForText',
				text: synthesisEvidence[0].excerpt,
			},
		],
	},
	{
		id: 'working-cluster-created',
		title: 'Working cluster grouping created',
		description: 'A researcher creates a provisional working cluster grouping before adding evidence.',
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
				text: `Created cluster ${synthesisEmptyCluster.label}.`,
			},
		],
	},
	{
		id: 'evidence-added-to-cluster',
		title: 'Evidence added to working cluster grouping',
		description:
			'A researcher selects two evidence notes and adds them to an existing working cluster grouping.',
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
		title: 'Theme creation blocked without evidence',
		description: 'Theme creation is blocked until the selected cluster contains source evidence.',
		path: synthesisPath,
		mockRoutes: synthesisMockRoutes({ clusters: [synthesisEmptyCluster] }),
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
				type: 'click',
				selector: '#create-theme',
			},
			{
				type: 'waitForText',
				text: 'Add at least one evidence item to the cluster before creating a theme.',
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
