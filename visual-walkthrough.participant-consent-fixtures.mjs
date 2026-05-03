/* eslint-env node */

/**
 * @file visual-walkthrough.participant-consent-fixtures.mjs
 * @summary Deterministic mocked states for the participant consent visual walkthrough.
 */

export const participantConsentProjectId = "recVisualConsentProject001";
export const participantConsentStudyId = "recVisualConsentStudy001";
export const participantConsentPath = `/pages/study/participant-consent/?pid=${participantConsentProjectId}&sid=${participantConsentStudyId}`;

const projectsRoute = /\/api\/projects(?:\?.*)?$/;
const studiesRoute = /\/api\/studies(?:\?.*)?$/;
const participantsRoute = /\/api\/participants(?:\?.*)?$/;
const consentFormsRoute = /\/api\/consent-forms(?:\?.*)?$/;
const participantConsentRoute = /\/api\/participant-consent(?:\?.*)?$/;

export const participantConsentProject = {
  id: participantConsentProjectId,
  name: "Assisted Digital Support Discovery",
};

export const participantConsentStudy = {
  id: participantConsentStudyId,
  title: "Assisted digital support interview round 1",
  method: "Moderated interview",
  status: "Planned",
  createdAt: "2026-05-01T09:30:00.000Z",
};

export const participantConsentItems = [
  {
    id: "participation",
    label:
      "I understand what taking part involves and I agree to take part in this research.",
    required: true,
  },
  {
    id: "voluntary",
    label:
      "I understand that taking part is voluntary and that I can stop the session at any time.",
    required: true,
  },
  {
    id: "data-use",
    label: "I understand how my information will be used for this research.",
    required: true,
  },
  {
    id: "recording",
    label:
      "I agree to the session being recorded if recording is being used for this study.",
    required: false,
  },
  {
    id: "observers",
    label:
      "I agree to observers joining the session if observers are part of this study.",
    required: false,
  },
  {
    id: "transcription",
    label:
      "I agree to transcription being used if transcription is part of this study.",
    required: false,
  },
];

export const participantConsentForm = {
  id: "consent-form-v2",
  title: "Assisted digital interview consent form",
  version: 2,
  status: "Published",
  consentItems: participantConsentItems,
};

export const participantConsentParticipants = [
  {
    id: "participant-sofia-patel",
    display_name: "Sofia Patel",
    name: "Sofia Patel",
  },
  {
    id: "participant-morgan-evans",
    display_name: "Morgan Evans",
    name: "Morgan Evans",
  },
  {
    id: "participant-aisha-khan",
    display_name: "Aisha Khan",
    name: "Aisha Khan",
  },
];

export const participantConsentRecords = [
  {
    id: "participant-consent-sofia",
    studyId: participantConsentStudyId,
    participantId: "participant-sofia-patel",
    consentFormId: participantConsentForm.id,
    consentFormVersion: 2,
    status: "Ready for session",
    captureMethod: "Verbal",
    withdrawn: false,
    recordedAt: "2026-05-01",
    recordedBy: "Alex Morgan",
    responses: {
      participation: "agreed",
      voluntary: "agreed",
      "data-use": "agreed",
      recording: "declined",
      observers: "agreed",
      transcription: "agreed",
    },
  },
  {
    id: "participant-consent-morgan",
    studyId: participantConsentStudyId,
    participantId: "participant-morgan-evans",
    consentFormId: participantConsentForm.id,
    consentFormVersion: 1,
    status: "Needs review",
    captureMethod: "Email",
    withdrawn: false,
    recordedAt: "2026-04-28",
    recordedBy: "Alex Morgan",
    responses: {
      participation: "agreed",
      voluntary: "agreed",
      "data-use": "agreed",
      recording: "not-asked",
      observers: "not-asked",
      transcription: "not-asked",
    },
  },
  {
    id: "participant-consent-aisha",
    studyId: participantConsentStudyId,
    participantId: "participant-aisha-khan",
    consentFormId: participantConsentForm.id,
    consentFormVersion: 2,
    status: "Withdrawn",
    captureMethod: "Verbal",
    withdrawn: true,
    withdrawalReason:
      "Participant chose not to continue after the study purpose was explained.",
    recordedAt: "2026-05-01",
    recordedBy: "Alex Morgan",
    responses: {
      participation: "declined",
      voluntary: "agreed",
      "data-use": "not-asked",
      recording: "not-asked",
      observers: "not-asked",
      transcription: "not-asked",
    },
  },
];

export function participantConsentMockRoutes({
  project = participantConsentProject,
  study = participantConsentStudy,
  participants = participantConsentParticipants,
  consentForms = [participantConsentForm],
  participantConsentRecords: records = participantConsentRecords,
} = {}) {
  return [
    {
      url: projectsRoute,
      method: "GET",
      body: {
        projects: [project],
      },
    },
    {
      url: studiesRoute,
      method: "GET",
      body: {
        studies: [study],
      },
    },
    {
      url: participantsRoute,
      method: "GET",
      body: {
        participants,
      },
    },
    {
      url: consentFormsRoute,
      method: "GET",
      body: {
        consentForms,
      },
    },
    {
      url: participantConsentRoute,
      method: "GET",
      body: {
        participantConsentRecords: records,
      },
    },
  ];
}
