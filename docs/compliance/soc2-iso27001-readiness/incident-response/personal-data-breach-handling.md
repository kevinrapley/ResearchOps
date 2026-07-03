# ResearchOps personal data breach handling process

This process supports ResearchOps readiness for incidents involving personal data.

It is not legal advice and it does not replace Home Office privacy, legal, security or Data Protection Officer direction. It gives the ResearchOps team a practical route for recognising a possible breach, preserving evidence and escalating early enough for the right decision to be made.

## Official reference points

The Information Commissioner's Office guidance says organisations must assess the likely risk to people's rights and freedoms after a personal data breach. If risk is likely, the ICO should be notified as soon as possible and, where feasible, within 72 hours. If the risk to people is high, affected people must also be notified without undue delay.

The ICO audit framework also expects organisations to record decisions not to report, reasons for delay, advice received, DPO involvement and internal or external communications during a breach.

References:

- [UK GDPR data breach reporting](https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/)
- [ICO reporting processes audit framework](https://ico.org.uk/for-organisations/advice-and-services/audits/data-protection-audit-framework/toolkits/personal-data-breach-management/reporting-processes/)

## When to start this process

Start this process when an incident may involve:

- participant identifiers, contact details, access needs, consent state or consent history
- research notes, journals, synthesis outputs or repository records that include personal data
- authenticated user names, email addresses, role assignments or access logs
- integration exports, provider logs or AI-assisted processing that may include personal data
- data being lost, altered, disclosed, retained too long or made unavailable

Do not wait for certainty. Start the process, record that the breach status is unconfirmed, then close the breach route later if the facts show personal data was not involved.

## Decision route

1. **Start the timer**
   - Record when ResearchOps became aware of the suspected breach.
   - Record who raised it and how it was detected.
   - Open an incident record and preserve evidence.

2. **Contain first, but preserve evidence**
   - Remove public or unauthorised access.
   - Revoke exposed secrets or sessions if needed.
   - Stop affected jobs, integrations or routes if ongoing harm is possible.
   - Avoid deleting logs, audit records or affected artefacts before evidence is captured.

3. **Describe the personal data**
   - Identify data classes affected.
   - Estimate number and type of people affected.
   - Note whether participant, special-category, safeguarding or sensitive operational information may be present.
   - Record whether data was viewed, copied, changed, deleted, retained longer than agreed or made unavailable.

4. **Assess risk to people**
   - Consider distress, discrimination, safeguarding, identity misuse, loss of confidentiality, operational harm and loss of trust.
   - Consider whether the people affected include vulnerable participants or people in sensitive research contexts.
   - Record the basis for the risk decision.

5. **Escalate the decision**
   - Notify the ResearchOps service owner.
   - Notify the information asset owner or agreed data owner route.
   - Notify the security representative.
   - Notify the privacy representative or Data Protection Officer route.
   - Involve legal or senior risk ownership where Home Office procedure requires it.

6. **Decide whether to notify the ICO**
   - The notification decision belongs to the authorised Home Office privacy and accountability route, not to an individual developer.
   - If risk to people's rights and freedoms is likely, prepare for notification as soon as possible and, where feasible, within 72 hours of awareness.
   - If notification is not made, record the decision, reasoning and who approved it.
   - If the 72-hour window cannot be met, record the reason for delay and what information will follow later.

7. **Decide whether to notify affected people**
   - If risk is high, prepare affected-person communication without undue delay through the authorised Home Office route.
   - Communication should explain what happened, what data was involved, likely consequences, actions already taken, recommended steps and a contact route.
   - Do not contact affected people informally or before the authorised route agrees the message.

8. **Close with learning**
   - Record containment, recovery and prevention actions.
   - Link fix commits, deployment evidence and tests.
   - Record lessons learned and owners for follow-up actions.
   - Update runbooks if the real incident showed they were unclear or incomplete.

## Minimum breach record

The incident record must include:

- incident identifier
- awareness time and reporting person or route
- systems, pages, records, suppliers or integrations involved
- data classes affected
- people affected or potentially affected
- containment actions and timing
- risk assessment outcome
- ICO notification decision and timing
- affected-person notification decision and timing
- roles involved in the decision
- evidence retained
- lessons learned and follow-up actions

## Evidence discipline

Keep the evidence useful and restrained:

- record enough to make the decision auditable
- do not copy raw personal data into the incident record unless it is essential
- store sensitive evidence in the approved Home Office evidence location
- link repository commits and tests without pasting secrets or personal data
- preserve supplier communications and advice received

