CREATE TABLE IF NOT EXISTS "projects" (
  "record_id" TEXT,
  "name" TEXT,
  "org" TEXT,
  "phase" TEXT,
  "status" TEXT,
  "description" TEXT,
  "stakeholders" TEXT,
  "objectives" TEXT,
  "usergroups" TEXT,
  "createdat" TEXT,
  "local_id" TEXT PRIMARY KEY,
  "project_details" TEXT,
  "project_studies" TEXT,
  "participants" TEXT,
  "journal_entries" TEXT,
  "memos" TEXT,
  "codes" TEXT,
  "code_applications" TEXT,
  "mural_boards" TEXT,
  "project_id_from_mural_boards" TEXT
);

INSERT INTO "projects" ("record_id", "name", "org", "phase", "status", "description", "stakeholders", "objectives", "usergroups", "createdat", "local_id", "project_details", "project_studies", "participants", "journal_entries", "memos", "codes", "code_applications", "mural_boards", "project_id_from_mural_boards") VALUES ('rec00J4gJcfVGNCG5', 'Biometric Service Modernisation', 'Home Office Biometrics', 'Alpha', 'Active', 'Modernising biometric systems and workflows to support future border, policing, and identity assurance services.', 'Programme Director; Operational Leads; Policy; Technical Architects; Vendors', '["Understand current biometric workflows and pain points","Design new user-centred biometric journeys","Ensure compliance with legal, ethical, and security standards"]', '["Border Force Officers","Police Staff","Biometric Specialists","External Partners"]', '2024-04-01T09:00:00Z', 'bf6f4386-e70d-4a2a-8b37-7fb9cca8e032', 'rec00vY1Oj3tA2Cqj', '["rec0105vm39A1k9z0","rec010hcTY8jYdt4R"]', '["rec011Gf40z3itgE6","rec011z5x6YSOn2qv"]', '["rec017uQePFLtIk8n","rec01845yiozWtdTQ"]', '["rec019og5Fpu5QnZh","rec019veC30YqSx8J"]', '["rec01BTCrFHNdGg2","rec01BipGvTtHGIoC"]', '["rec01Do9F7g2wcQH","rec01E2VfAQwF7A25"]', '["rec01F9Gki3aF1G2","rec01Fq2tohXy0dU5"]', 'rec01G7Kcg8S3n3AE');

INSERT INTO "projects" ("record_id", "name", "org", "phase", "status", "description", "stakeholders", "objectives", "usergroups", "createdat", "local_id", "project_details", "project_studies", "participants", "journal_entries", "memos", "codes", "code_applications", "mural_boards", "project_id_from_mural_boards") VALUES ('rec010B6YM8yXnZVz', 'ResearchOps Platform', 'Home Office Biometrics', 'Beta', 'Active', 'Building an internal ResearchOps platform to manage projects, studies, participants, consent, journals, and analysis tooling.', 'Head of Research; Product Owners; Delivery Managers; Security; Data Protection; Engineers', '["Improve governance and traceability of research","Reduce duplicated effort and tool fragmentation","Support ethical, inclusive research at scale"]', '["User Researchers","Designers","Product Managers","Operational Staff"]', '2024-05-15T10:30:00Z', 'd04ab32e-6756-408e-a649-6859dd0079f2', 'rec010vVYbZ9FjE9n', '["rec011xXhQYJpLwW1","rec0123Pu3EoG1h5s"]', '["rec012o9R3vVxAnZl","rec012xkDHWQGk5G8"]', '["rec013ThC8C17LK3n","rec013f7p3EwZP7Z4"]', '["rec014A4w5wH9nVtL","rec014oWw4Zg23v5G"]', '["rec0152Z0vpZ3Yx1H","rec015jVm2P7Xy3kL"]', '["rec016HY0g9n8zWmX","rec016p1Ku5tQn9XQ"]', '["rec0171NjF1a3xZqS","rec017dTgT9eWp3Lh"]', 'rec017wVYdNw5k1gM');

CREATE TABLE IF NOT EXISTS "project_details" (
  "record_id" TEXT PRIMARY KEY,
  "project" TEXT,
  "background" TEXT,
  "goals" TEXT,
  "scope" TEXT,
  "risks" TEXT,
  "constraints" TEXT,
  "assumptions" TEXT,
  "dependencies" TEXT,
  "local_project_id" TEXT
);

INSERT INTO "project_details" ("record_id", "project", "background", "goals", "scope", "risks", "constraints", "assumptions", "dependencies", "local_project_id") VALUES ('rec00vY1Oj3tA2Cqj', 'rec00J4gJcfVGNCG5', 'Legacy biometric systems are fragmented, with multiple user journeys across policing and border contexts. User experience and operational efficiency are impacted.', '["Map and understand current-state biometric journeys","Co-design future-state journeys with users","Inform procurement and technical decisions with user evidence"]', '["Operational journeys in policing and borders","Staff-facing tools and systems","Supporting guidance and policies"]', '["Dependence on legacy contracts","Data quality and interoperability issues","Stakeholder risk appetite and timelines"]', '["Operational environments cannot be easily replicated","Some user groups are hard to reach due to shift work and security constraints"]', '["Stakeholders will engage with user research findings","Test environments will be made available in time"]', '["Other transformation programmes in the Home Office","Shared technology platforms (e.g. identity, caseworking)"]', 'bf6f4386-e70d-4a2a-8b37-7fb9cca8e032');

INSERT INTO "project_details" ("record_id", "project", "background", "goals", "scope", "risks", "constraints", "assumptions", "dependencies", "local_project_id") VALUES ('rec010vVYbZ9FjE9n', 'rec010B6YM8yXnZVz', 'Research activity, artefacts, and decisions are spread across tools. There is limited traceability from project inception through to analysis and publication.', '["Provide a single place to manage research projects and artefacts","Embed governance and ethics into everyday workflows","Support analysis and reuse of research insights"]', '["Internal research projects","Study planning and consent","Journals, codes, memos, and analysis"]', '["Adoption depends on busy teams changing habits","Integration with existing tools and security controls"]', '["Must align with HO security and data protection requirements","Limited engineering capacity for custom integrations early on"]', '["Teams will be motivated by reduced friction and better governance","Key stakeholders will support iterative roll-out"]', '["Identity and access management platforms","Data retention and archiving services"]', 'd04ab32e-6756-408e-a649-6859dd0079f2');

CREATE TABLE IF NOT EXISTS "journal_entries" (
  "record_id" TEXT PRIMARY KEY,
  "project" TEXT,
  "category" TEXT,
  "content" TEXT,
  "tags" TEXT,
  "createdat" TEXT,
  "local_project_id" TEXT
);

INSERT INTO "journal_entries" ("record_id", "project", "category", "content", "tags", "createdat", "local_project_id") VALUES ('rec017uQePFLtIk8n', 'rec00J4gJcfVGNCG5', 'perceptions', 'Early sessions suggest staff feel the current biometric tools are fragmented and hard to navigate. They improvise workarounds that are invisible to system owners.', '["fragmentation","workarounds","staff experience"]', '2024-05-01T14:00:00Z', 'bf6f4386-e70d-4a2a-8b37-7fb9cca8e032');

INSERT INTO "journal_entries" ("record_id", "project", "category", "content", "tags", "createdat", "local_project_id") VALUES ('rec01845yiozWtdTQ', 'rec00J4gJcfVGNCG5', 'decisions', 'We decided to prioritise mapping end-to-end journeys in policing before borders, to align with programme milestones and available environments.', '["prioritisation","journey mapping","policing first"]', '2024-05-10T11:30:00Z', 'bf6f4386-e70d-4a2a-8b37-7fb9cca8e032');

INSERT INTO "journal_entries" ("record_id", "project", "category", "content", "tags", "createdat", "local_project_id") VALUES ('rec013ThC8C17LK3n', 'rec010B6YM8yXnZVz', 'procedures', 'Set up weekly triage to review incoming research requests and align them with platform capabilities and constraints.', '["governance","triage","platform"]', '2024-06-05T09:15:00Z', 'd04ab32e-6756-408e-a649-6859dd0079f2');

INSERT INTO "journal_entries" ("record_id", "project", "category", "content", "tags", "createdat", "local_project_id") VALUES ('rec013f7p3EwZP7Z4', 'rec010B6YM8yXnZVz', 'introspections', 'Noticed a tension between giving teams flexibility and needing consistent governance. The platform should support both without feeling heavy-handed.', '["tension","governance","flexibility"]', '2024-06-12T16:45:00Z', 'd04ab32e-6756-408e-a649-6859dd0079f2');

CREATE TABLE IF NOT EXISTS "memos" (
  "record_id" TEXT,
  "project" TEXT,
  "type" TEXT,
  "title" TEXT,
  "body" TEXT,
  "createdat" TEXT,
  "local_project_id" TEXT,
  "local_memo_id" TEXT PRIMARY KEY
);

INSERT INTO "memos" ("record_id", "project", "type", "title", "body", "createdat", "local_project_id", "local_memo_id") VALUES ('rec019og5Fpu5QnZh', 'rec00J4gJcfVGNCG5', 'analytical', 'Fragmentation of biometric journeys', 'Across sessions, fragmentation appears in multiple forms: tools, handoffs, and information sources. This may be a core theme.', '2024-05-08T15:00:00Z', 'bf6f4386-e70d-4a2a-8b37-7fb9cca8e032', 'memo-001');

INSERT INTO "memos" ("record_id", "project", "type", "title", "body", "createdat", "local_project_id", "local_memo_id") VALUES ('rec019veC30YqSx8J', 'rec010B6YM8yXnZVz', 'methodological', 'Rolling out platform features incrementally', 'We need to test platform features with a small set of teams before scaling. Consider a structured “opt-in beta” approach.', '2024-06-02T10:00:00Z', 'd04ab32e-6756-408e-a649-6859dd0079f2', 'memo-002');

CREATE TABLE IF NOT EXISTS "codes" (
  "record_id" TEXT,
  "project" TEXT,
  "name" TEXT,
  "description" TEXT,
  "parentcode" TEXT,
  "colour" TEXT,
  "createdat" TEXT,
  "local_project_id" TEXT,
  "local_code_id" TEXT PRIMARY KEY
);

INSERT INTO "codes" ("record_id", "project", "name", "description", "parentcode", "colour", "createdat", "local_project_id", "local_code_id") VALUES ('rec01BTCrFHNdGg2', 'rec00J4gJcfVGNCG5', 'Fragmented workflows', 'Steps in a journey that require switching between multiple tools or channels.', '', '#d53880', '2024-05-03T13:00:00Z', 'bf6f4386-e70d-4a2a-8b37-7fb9cca8e032', 'code-001');

INSERT INTO "codes" ("record_id", "project", "name", "description", "parentcode", "colour", "createdat", "local_project_id", "local_code_id") VALUES ('rec01BipGvTtHGIoC', 'rec010B6YM8yXnZVz', 'Governance friction', 'Moments where governance or process requirements feel heavy, confusing, or duplicative.', '', '#003078', '2024-06-07T14:20:00Z', 'd04ab32e-6756-408e-a649-6859dd0079f2', 'code-002');

CREATE TABLE IF NOT EXISTS "discussion_guides" (
  "record_id" TEXT PRIMARY KEY,
  "project" TEXT,
  "title" TEXT,
  "version" TEXT,
  "status" TEXT,
  "body" TEXT,
  "createdat" TEXT,
  "local_project_id" TEXT
);

INSERT INTO "discussion_guides" ("record_id", "project", "title", "version", "status", "body", "createdat", "local_project_id") VALUES ('rec011xXhQYJpLwW1', 'rec010B6YM8yXnZVz', 'ResearchOps platform discovery interviews', 'v1.0', 'Draft', '## Introduction

Thank you for taking the time to speak with us today. We''re exploring how research is currently planned, run, and shared, and how a ResearchOps platform might help.

## Warm-up

- Can you tell me about your role and how you currently run user research?
- What tools and processes do you use today?

## Main topics

1. Project setup and planning
2. Consent and governance
3. Artefact management (notes, recordings, analysis)
4. Sharing findings and influencing decisions

## Wrap-up

- If you could change one thing about how research is managed today, what would it be?', '2024-05-20T13:30:00Z', 'd04ab32e-6756-408e-a649-6859dd0079f2');

INSERT INTO "discussion_guides" ("record_id", "project", "title", "version", "status", "body", "createdat", "local_project_id") VALUES ('rec0123Pu3EoG1h5s', 'rec010B6YM8yXnZVz', 'Biometric service research check-in', 'v0.3', 'Draft', '## Purpose

Check in with biometric service teams on early findings, validate assumptions, and understand upcoming decisions.

## Topics

- Reactions to early findings
- Gaps or surprises
- Upcoming decisions that need evidence
- How research can better support teams', '2024-06-01T11:00:00Z', 'd04ab32e-6756-408e-a649-6859dd0079f2');

CREATE TABLE IF NOT EXISTS "journal_excerpts" (
  "record_id" TEXT,
  "project" TEXT,
  "entry" TEXT,
  "excerpt" TEXT,
  "codes" TEXT,
  "createdat" TEXT,
  "local_project_id" TEXT,
  "local_excerpt_id" TEXT PRIMARY KEY
);

INSERT INTO "journal_excerpts" ("record_id", "project", "entry", "excerpt", "codes", "createdat", "local_project_id", "local_excerpt_id") VALUES ('rec016HY0g9n8zWmX', 'rec00J4gJcfVGNCG5', 'rec017uQePFLtIk8n', '“I have to keep three different systems open to get through one case.”', '["code-001"]', '2024-05-09T10:45:00Z', 'bf6f4386-e70d-4a2a-8b37-7fb9cca8e032', 'excerpt-001');

INSERT INTO "journal_excerpts" ("record_id", "project", "entry", "excerpt", "codes", "createdat", "local_project_id", "local_excerpt_id") VALUES ('rec016p1Ku5tQn9XQ', 'rec010B6YM8yXnZVz', 'rec013f7p3EwZP7Z4', '“Governance should feel like a helpful guardrail, not a barrier.”', '["code-002"]', '2024-06-15T09:20:00Z', 'd04ab32e-6756-408e-a649-6859dd0079f2', 'excerpt-002');

CREATE TABLE IF NOT EXISTS "session_notes" (
  "record_id" TEXT,
  "localnoteid" TEXT,
  "project" TEXT,
  "localprojectid" TEXT,
  "entryid" TEXT,
  "local_entry_id" TEXT,
  "noteid" TEXT,
  "local_note_id" TEXT PRIMARY KEY,
  "createdat" TEXT,
  "kind" TEXT,
  "source" TEXT
);

INSERT INTO "session_notes" ("record_id", "localnoteid", "project", "localprojectid", "entryid", "local_entry_id", "noteid", "local_note_id", "createdat", "kind", "source") VALUES ('rec01Do9F7g2wcQH', 'note-legacy-001', 'rec00J4gJcfVGNCG5', 'bf6f4386-e70d-4a2a-8b37-7fb9cca8e032', 'rec017uQePFLtIk8n', 'entry-legacy-001', 'note-001', 'note-001', '2024-05-02T11:00:00Z', 'observation', 'session:interview');

INSERT INTO "session_notes" ("record_id", "localnoteid", "project", "localprojectid", "entryid", "local_entry_id", "noteid", "local_note_id", "createdat", "kind", "source") VALUES ('rec01E2VfAQwF7A25', 'note-legacy-002', 'rec010B6YM8yXnZVz', 'd04ab32e-6756-408e-a649-6859dd0079f2', 'rec013ThC8C17LK3n', 'entry-legacy-002', 'note-002', 'note-002', '2024-06-06T15:30:00Z', 'decision', 'session:workshop');

CREATE TABLE IF NOT EXISTS "communications_log" (
  "record_id" TEXT PRIMARY KEY,
  "timestamp" TEXT,
  "project" TEXT,
  "local_project_id" TEXT,
  "channel" TEXT,
  "direction" TEXT,
  "summary" TEXT,
  "notes" TEXT
);

INSERT INTO "communications_log" ("record_id", "timestamp", "project", "local_project_id", "channel", "direction", "summary", "notes") VALUES ('rec0171NjF1a3xZqS', '2024-05-04T10:00:00Z', 'rec00J4gJcfVGNCG5', 'bf6f4386-e70d-4a2a-8b37-7fb9cca8e032', 'email', 'outbound', 'Shared early journey maps with programme stakeholders for feedback.', 'Included clear caveats about sample size and early-stage nature of findings.');

INSERT INTO "communications_log" ("record_id", "timestamp", "project", "local_project_id", "channel", "direction", "summary", "notes") VALUES ('rec017dTgT9eWp3Lh', '2024-06-08T09:30:00Z', 'rec010B6YM8yXnZVz', 'd04ab32e-6756-408e-a649-6859dd0079f2', 'meeting', 'bidirectional', 'ResearchOps steering group check-in on roadmap and adoption risks.', 'Agreed to focus on a small number of high-value workflows first.');

CREATE TABLE IF NOT EXISTS "partials" (
  "record_id" TEXT PRIMARY KEY,
  "slug" TEXT,
  "title" TEXT,
  "body" TEXT,
  "createdat" TEXT
);

INSERT INTO "partials" ("record_id", "slug", "title", "body", "createdat") VALUES ('rec01G7Kcg8S3n3AE', 'project-intro', 'Project introduction panel', '<p>This project dashboard is part of the Home Office Biometrics ResearchOps platform. It helps you manage research projects, studies, sessions, and analysis artefacts in one place.</p>', '2024-05-01T09:00:00Z');
