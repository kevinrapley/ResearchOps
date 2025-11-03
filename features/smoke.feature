Feature: Site smoke

  Background:
    Given the site base URL

  @smoke
  Scenario: Home loads
    When I visit "/"
    Then the page should contain "Research" within 5s

  @smoke
  Scenario: Projects page loads
    When I visit "/pages/projects/index.html"
    Then the page should have a <title> containing "Projects"

  @a11y-lite
  Scenario: Start page has main landmarks
    When I visit "/pages/start/index.html"
    Then I should see an element "main"
    And I should see an element "header"
    And I should see an element "footer"
