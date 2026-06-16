Feature: Smoke

  Scenario: Home loads
    Given the site base URL
    When I visit "/"
    Then the page should contain "Research" within 5s

  Scenario: Sign-in page loads
    Given the site base URL
    When I visit "/pages/account/sign-in/index.html"
    Then the page should have a <title> containing "Sign in"

  Scenario: Start page has main landmarks
    Given the site base URL
    When I visit "/pages/start/index.html"
    Then I should see an element "main"
    And I should see an element "header.govuk-header"
    And I should see an element "footer"
