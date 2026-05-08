# Authentication and role-selection decisions

**Date:** 2026-05-08
**Status:** decision record
**Related requirements:** [`authentication-role-selection-requirements-2026-05-08.md`](authentication-role-selection-requirements-2026-05-08.md)
**Related reference notes:** [`authentication-role-selection-reference-notes-2026-05-08.md`](authentication-role-selection-reference-notes-2026-05-08.md)

This record captures 200 decisions from the authentication and role-selection design conversation.

Questions 1 to 78 were answered directly. Questions 79 to 200 use the agreed steer as the answer.

## Decisions

| No. | Question | Answer | Design implication |
|---:|---|:---:|---|
| 1 | Auth architecture | B | External auth + D1 RBAC |
| 2 | Account creation model | C | Hybrid onboarding |
| 3 | Minimum account data | A | Short sign-up |
| 4 | Identity/team/role model | A | Separate concepts |
| 5 | New-user default access | B | Least privilege |
| 6 | First role scope | A | Team first; scoped schema |
| 7 | Collaborator route | C | Controlled invitations |
| 8 | Authority store | A | D1 canonical |
| 9 | Airtable authority | C | Data layer only |
| 10 | Sensitive roles | C | Elevated approval |
| 11 | Team and personal data | C | Explicit permission |
| 12 | Role checks | C | Permission-based |
| 13 | Permission codes in UI | B | Plain English |
| 14 | Status model | C | Account ≠ role |
| 15 | Role lifecycle | B | Pending/active/expired |
| 16 | Permission audit | B | Auditable changes |
| 17 | Auth events | A | Logged events |
| 18 | Failed sign-in | A | No enumeration |
| 19 | Logout boundary | A | Explain SSO |
| 20 | Timeout handling | A | Warn + preserve |
| 21 | Error language | A | Plain English |
| 22 | Permissions endpoint | A | UI state support |
| 23 | Direct API attempts | A | Server blocks |
| 24 | Airtable access | A | Authorise first |
| 25 | User identifiers | A | Stable IDs |
| 26 | Agent authority | B | No access decisions |
| 27 | Abuse checks | A | Server validation |
| 28 | Secrets | C | Cloudflare secrets |
| 29 | View/reveal split | A | Separate permissions |
| 30 | Reveal reason | C | Not required |
| 31 | Reveal time limit | A | Auto-hide |
| 32 | Standard reveal time | B | 5 minutes |
| 33 | Sensitive reveal time | B | 1 minute |
| 34 | Extra auth check | C | Future-ready |
| 35 | Data export | C | Reserve export |
| 36 | Own activity | A | User transparency |
| 37 | Activity identifier | A | Pseudonym only |
| 38 | Names in audit | B | Extra permission |
| 39 | Revealed field detail | A | Field group only |
| 40 | Audit mutability | B | Controlled redaction |
| 41 | Redaction approval | A | Two owners |
| 42 | Failed reveal audit | A | Audit failures |
| 43 | Failed reveal alerts | B | Repeated only |
| 44 | Alert recipients | B | Admin + safeguarding |
| 45 | Alert email | C | Safeguarding only |
| 46 | Live-session reveal | B | Owner/researcher |
| 47 | Observer reveal | A | Blocked |
| 48 | Observer indicators | A | Hidden |
| 49 | Note-taker reveal | B | Blocked |
| 50 | Note-taker flags | B | Flag only |
| 51 | Note-taker observations | B | Review required |
| 52 | Observation notification | B | Researchers first |
| 53 | Urgent marking | A | Signal only |
| 54 | Urgency reason | A | Controlled list |
| 55 | Urgent notes | B | Reason first |
| 56 | Urgent note visibility | D | Restricted + alerts |
| 57 | Lead note access | B | Product only |
| 58 | Email context | B | Pseudonym + session |
| 59 | Email timing | A | Immediate |
| 60 | Alert acknowledgement | A | Product required |
| 61 | Acknowledgement method | A | Product only |
| 62 | Acknowledgement actor | B | Lead/delegate |
| 63 | Acknowledgement status | C | Three states |
| 64 | Acknowledgement comment | C | Escalated only |
| 65 | Missed ack timing | A | 15 minutes |
| 66 | Missed ack recipient | B | Second lead |
| 67 | Severity levels | B | Urgent/critical |
| 68 | Severity actor | A | Lead only |
| 69 | Note-taker status view | A | Status only |
| 70 | Researcher detail view | A | Permission-gated |
| 71 | Acknowledgement events | C | Redactable |
| 72 | Notification store | A | D1 canonical |
| 73 | Airtable mirror | A | Minimal status |
| 74 | Free-text storage | B | D1 only |
| 75 | Separate encryption | C | Later |
| 76 | Retention | A | Team-configured |
| 77 | Retention owners | D | Admin + lead |
| 78 | Safeguarding export | C | Future permission |
| 79 | Safeguarding audit | C | Filtered view |
| 80 | General audit scope | B | Separate permission |
| 81 | Safeguarding audit permission | A | Add permission |
| 82 | Role approval | A | Sensitive only |
| 83 | Sensitive set | B | PII + audit roles |
| 84 | Sensitive approval | B | Admin + owner |
| 85 | Self-grant | C | Second approval |
| 86 | Role expiry | B | Sensitive only |
| 87 | Expiry duration | C | 180 days |
| 88 | Expiry warning | A | 14 days |
| 89 | Expiry enforcement | A | Immediate block |
| 90 | Pending access | B | Low-risk only |
| 91 | Denied requests | A | Audited |
| 92 | Denial actor | B | Hidden |
| 93 | Request reason | A | Sensitive only |
| 94 | Change reason | B | Sensitive only |
| 95 | Direct permissions | B | Exceptions allowed |
| 96 | Exception expiry | A | Always expire |
| 97 | Scope fields | A | `scope_type/id` |
| 98 | Enforced scope | A | Team only |
| 99 | Scope UI | A | Hide first |
| 100 | Permissions payload | C | Codes + labels |
| 101 | Missing codes | C | Admin diagnostics |
| 102 | Access links | A | Recovery route |
| 103 | Request routing | A | By permission |
| 104 | Request email | C | Sensitive only |
| 105 | Admin request view | A | All requests |
| 106 | Safeguarding requests | A | Lead visibility |
| 107 | Approver loop | C | With admin |
| 108 | Account route | C | Hybrid |
| 109 | First auth route | C | Access/OIDC + invites |
| 110 | Password auth | C | Later if needed |
| 111 | Magic links | C | Later |
| 112 | MFA | C | IdP policy |
| 113 | MFA storage | C | Provider claim |
| 114 | Step-up schema | A | Model now |
| 115 | Step-up build | B | Defer |
| 116 | Session expiry | A | Auto-expire |
| 117 | Expiry warning | B | 5 minutes |
| 118 | Autosave | A | Long notes |
| 119 | Autosave encryption | B | Later |
| 120 | IP address | C | Hash/partial |
| 121 | User agent | C | Browser family |
| 122 | Route context | A | Include route |
| 123 | Request ID | A | Include ID |
| 124 | API audit volume | C | Sensitive only |
| 125 | Denied API audit | B | Sensitive only |
| 126 | Audit UI | A | Limited view |
| 127 | Account activity | A | User-visible |
| 128 | Failed sign-ins | A | Show attempts |
| 129 | Location | C | Country only |
| 130 | Activity download | C | Later |
| 131 | Audit export | C | Later permission |
| 132 | Export schema | A | Reserve now |
| 133 | Field groups | B | Fixed first |
| 134 | Sensitive groups | B | Fixed list |
| 135 | Warnings | A | By group |
| 136 | Standard timeout | A | Keep 5 min |
| 137 | Sensitive timeout | A | Keep 1 min |
| 138 | Refresh reveal state | B | Reset hidden |
| 139 | Tab reveal state | B | Reset hidden |
| 140 | Reveal intent | A | Visible intent |
| 141 | Reveal confirmation | A | Sensitive only |
| 142 | Reveal reason | A | Optional |
| 143 | Reveal alert | B | Activity only |
| 144 | Access history | A | Authorised users |
| 145 | Actor names | C | Audit permission |
| 146 | Change summaries | B | Sensitive objects |
| 147 | Summary objects | A | Approvals/findings/recs |
| 148 | Decision owner | C | Accepted recs |
| 149 | Owner type | A | User only |
| 150 | Ownership transfer | A | Transferable |
| 151 | Transfer actor | C | Owner/admin |
| 152 | Approval reversal | C | Supersede |
| 153 | Two approvers | B | High-risk only |
| 154 | High-risk definition | C | Checklist |
| 155 | Risk audit | A | Audited |
| 156 | Accessibility needs | A | Highly sensitive |
| 157 | Contact details | A | Standard sensitivity |
| 158 | Flags outside sessions | A | Authorised only |
| 159 | Flag existence | A | Hidden |
| 160 | Agent support | C | Admin guidance |
| 161 | Agent audit summaries | C | Later |
| 162 | Agent role suggestions | C | Suggest only |
| 163 | Agent safeguarding content | C | Later controls |
| 164 | Public registration | C | Later |
| 165 | Unauth access | A | Info pages only |
| 166 | Signed-in home | A | Contextual home |
| 167 | Team choice | A | Multiple teams |
| 168 | Header team | A | Visible team |
| 169 | Team-switch confirm | A | Unsaved work |
| 170 | Team-switch audit | B | No audit |
| 171 | Team removal | A | Immediate |
| 172 | Exported files | C | Admin warning |
| 173 | Session invalidation | C | Sensitive loss |
| 174 | `/api/me` cache | C | Short cache |
| 175 | Hidden controls | A | Test UI |
| 176 | API denial tests | A | Mandatory |
| 177 | Route mapping | A | Documented |
| 178 | Route declarations | A | Every route |
| 179 | Missing permission | A | Fail closed |
| 180 | CI coverage | A | Required |
| 181 | Seed versioning | A | Versioned |
| 182 | Permission migrations | C | Where safe |
| 183 | Trace documents | C | Major decisions |
| 184 | Implementation start | C | Docs + schema |
| 185 | First UI | C | Skeleton |
| 186 | First auth | B | Mock identity |
| 187 | Mock identity | A | Production-disabled |
| 188 | D1 migrations | A | First build |
| 189 | Airtable changes | B | Not first |
| 190 | PII reveal UI | B | Not first |
| 191 | Alert UI | C | Prototype |
| 192 | Audit UI | C | Account activity |
| 193 | Role UI | A | Basic admin |
| 194 | Role API | C | Admin-only |
| 195 | Role tests | A | Required |
| 196 | Security review | A | Required |
| 197 | Accessibility review | A | Required |
| 198 | Threat model | A | Required |
| 199 | Data protection review | C | Before reveal |
| 200 | Next artefacts | D | PDR + schema + epic |

## Thematic implications

### Identity and access

Use external authentication for identity and D1 for ResearchOps-specific access control. Keep identity, team membership, role assignment and permissions separate.

### Authorisation boundary

The Worker is the policy enforcement point. It must validate identity and permissions before protected Airtable access.

### Participant data

Pseudonymised participant views are the default. Personal data reveal is explicit, time-limited, permission-gated and auditable.

### Safeguarding

Safeguarding detail, audit and notification flows require separate permissions. Email alerts contain minimal context only.

### Audit

Audit sensitive actions, sensitive denials and major governance changes. Avoid storing unnecessary personal data in audit records.

### UI

Use plain-English role descriptions, permission-denied recovery routes, account activity and basic Team Admin role management.

### Cloudflare and Agents

Cloudflare Access or OIDC plus invitations is the first authentication direction. Agents can guide, but cannot grant access or make final decisions.

### Sequencing

Next artefacts are the product decision record, D1 schema proposal and implementation epic. First build should use mock identity, D1 migrations, route-permission mapping and denial tests.
