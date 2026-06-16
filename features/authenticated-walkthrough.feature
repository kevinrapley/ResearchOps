Feature: Authenticated visual walkthrough

  Scenario: Sign-in code state is captured
    Given the site base URL
    When I request a ResearchOps sign-in code for the QA walkthrough user
    Then the sign-in page should ask for the 6 digit code

  Scenario: Authenticated application states are captured
    Given the site base URL
    And the QA walkthrough uses deterministic application state
    When I capture every registered ResearchOps page with authenticated QA state
    Then the authenticated QA walkthrough should have captured every registered state
