# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses, visualize spending by category, monitor a total balance, set a spending limit, toggle between light and dark themes, and review a monthly summary — all without a backend server. All data is persisted in the browser's Local Storage. The application is built using plain HTML, CSS, and Vanilla JavaScript with an optional chart library (e.g., Chart.js) for visualizations.

---

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, and a category.
- **Category**: A classification for a transaction; one of: Food, Transport, or Fun.
- **Transaction_List**: The scrollable list of all stored transactions displayed in the UI.
- **Balance_Display**: The UI element that shows the computed total of all transaction amounts.
- **Pie_Chart**: The visual chart showing the proportional spending distribution across categories.
- **Spending_Limit**: A user-defined monetary threshold used to trigger a visual highlight when total spending exceeds it.
- **Theme_Toggle**: The UI control that switches the App between light mode and dark mode.
- **Monthly_Summary**: A view that groups and displays total spending per category for a selected month and year.
- **Local_Storage**: The browser's Web Storage API used to persist all application data client-side.
- **Validator**: The component responsible for checking that all form fields are filled before a transaction is submitted.

---

## Requirements

### Requirement 1: Add a Transaction

**User Story:** As a user, I want to fill in a form with an item name, amount, and category so that I can record an expense quickly.

#### Acceptance Criteria

1. THE App SHALL render an input form containing three fields: Item Name (text), Amount (number), and Category (select with options: Food, Transport, Fun).
2. WHEN the user submits the form with all fields filled, THE App SHALL add the transaction to the Transaction_List and persist it to Local_Storage.
3. WHEN the user submits the form, THE Validator SHALL verify that Item Name is not empty and does not exceed 100 characters, Amount is a positive number between 0.01 and 999,999,999.99 with at most 2 decimal places, and Category is selected.
4. IF the Validator detects one or more empty or invalid fields, THEN THE App SHALL display an inline validation message identifying which fields are incomplete, and SHALL NOT add the transaction.
5. WHEN a transaction is successfully added, THE App SHALL clear the form fields and return focus to the Item Name field.
6. IF the Local_Storage write operation fails when adding a transaction, THEN THE App SHALL display an error notification to the user and SHALL NOT update the Transaction_List.

---

### Requirement 2: Display Transaction List

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list so that I can review my expenses at a glance.

#### Acceptance Criteria

1. THE App SHALL display all stored transactions in the Transaction_List, ordered by insertion timestamp from most recently added to oldest.
2. THE Transaction_List SHALL show the item name, amount formatted to 2 decimal places with a currency symbol, and category for each transaction.
3. WHEN the Transaction_List contains more entries than the visible height of its container, THE App SHALL make the Transaction_List scrollable without affecting the rest of the page layout.
4. WHEN the App loads, THE App SHALL retrieve all transactions from Local_Storage and populate the Transaction_List.
5. WHEN no transactions exist, THE Transaction_List SHALL display an empty-state message indicating no expenses have been recorded.
6. IF Local_Storage is unavailable or read fails on load, THE App SHALL display the Transaction_List in an empty state and show an error notification to the user.

---

### Requirement 3: Delete a Transaction

**User Story:** As a user, I want to delete individual transactions so that I can correct mistakes or remove outdated entries.

#### Acceptance Criteria

1. THE Transaction_List SHALL render a delete button, labeled or iconically identified as a delete action, for each transaction entry.
2. WHEN the user activates the delete button for a transaction, THE App SHALL remove that transaction from the Transaction_List and from Local_Storage.
3. WHEN a transaction is deleted, THE Balance_Display SHALL update without requiring a page reload to reflect the new total.
4. WHEN a transaction is deleted, THE Pie_Chart SHALL update without requiring a page reload to reflect the new spending distribution.

---

### Requirement 4: Total Balance Display

**User Story:** As a user, I want to see the total of all my expenses at the top of the page so that I always know my current spending total.

#### Acceptance Criteria

1. THE Balance_Display SHALL be the first visible element in the main content area at the top of the App.
2. THE Balance_Display SHALL show the sum of all transaction amounts formatted to 2 decimal places with a currency symbol.
3. WHEN a transaction is added, THE Balance_Display SHALL update its value within 1 second without requiring a page reload.
4. WHEN a transaction is deleted, THE Balance_Display SHALL update its value within 1 second without requiring a page reload.
5. WHEN no transactions exist, THE Balance_Display SHALL show a value of zero formatted to 2 decimal places with a currency symbol.

---

### Requirement 5: Spending Distribution Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category so that I can understand where my money is going.

#### Acceptance Criteria

1. THE App SHALL render a Pie_Chart that displays one segment per Category (Food, Transport, Fun) that has a non-zero total, where each segment shows the category name and its percentage of total spending.
2. WHEN a transaction is added, THE Pie_Chart SHALL re-render without a page reload to reflect the updated category totals.
3. WHEN a transaction is deleted, THE Pie_Chart SHALL re-render without a page reload to reflect the updated category totals.
4. WHEN only one Category has transactions, THE Pie_Chart SHALL display a single full segment for that Category showing 100%.
5. WHEN no transactions exist, THE Pie_Chart SHALL display the text "No spending data to display" in place of the chart.
6. WHEN the App loads, THE App SHALL render the Pie_Chart based on the transactions retrieved from Local_Storage.

---

### Requirement 6: Dark / Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light themes so that I can use the App comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL render the Theme_Toggle as an accessible button or checkbox control with a visible label or aria-label, visible at all times regardless of scroll position.
2. WHEN the user activates the Theme_Toggle, THE App SHALL switch the active theme: if light mode is active it switches to dark mode, and if dark mode is active it switches to light mode.
3. WHEN the user activates the Theme_Toggle, THE App SHALL persist the new theme preference value ("light" or "dark") in Local_Storage under a dedicated key.
4. WHEN the App loads and a theme preference exists in Local_Storage, THE App SHALL apply that saved theme before any content is rendered.
5. WHEN the App loads and no theme preference is saved in Local_Storage, THE App SHALL apply the theme matching the system preference via the `prefers-color-scheme` media query; if the media query is unsupported, THE App SHALL default to light mode.

---

### Requirement 7: Spending Limit Highlight

**User Story:** As a user, I want to set a spending limit and receive a visual warning when I exceed it so that I can stay within my budget.

#### Acceptance Criteria

1. THE App SHALL provide an input field where the user can enter a Spending_Limit as a positive number between 0.01 and 999,999,999.99; IF the user enters zero, a negative value, a non-numeric value, or a value outside this range, THE App SHALL display a validation error and SHALL NOT update the Spending_Limit.
2. WHEN the user sets a valid Spending_Limit, THE App SHALL persist the value in Local_Storage.
3. WHILE the sum of all recorded expense transactions exceeds the Spending_Limit, THE Balance_Display SHALL apply a visually differentiated style (distinct from its normal appearance) to indicate the limit has been exceeded.
4. WHILE the sum of all recorded expense transactions is at or below the Spending_Limit, THE Balance_Display SHALL display in the style used when no warning is active.
5. WHEN the App loads with a saved Spending_Limit, THE App SHALL evaluate the current total against the Spending_Limit and apply the visual state defined in criterion 3 or criterion 4 accordingly.
6. WHEN the user clears or removes the Spending_Limit, THE App SHALL remove the Spending_Limit from Local_Storage and THE Balance_Display SHALL revert to the normal style defined in criterion 4.

---

### Requirement 8: Monthly Summary View

**User Story:** As a user, I want to view a monthly summary of my expenses so that I can analyze my spending patterns over time.

#### Acceptance Criteria

1. THE App SHALL provide a Monthly_Summary section that displays the total spending per Category for a selected month and year; Categories with zero spending for the selected period SHALL NOT be displayed.
2. THE Monthly_Summary SHALL provide a month selector (1–12) and a year selector (ranging from the earliest year in the transaction data to the current year) to allow the user to choose the target period.
3. WHEN the user changes the selected month or year, THE Monthly_Summary SHALL update within 500ms to show totals filtered to that period without requiring a page reload.
4. WHEN no transactions exist for the selected month and year, THE Monthly_Summary SHALL display a message indicating that no data is available for that period.
5. THE Monthly_Summary SHALL display the grand total of all transactions (across all categories including any future categories) within the selected month and year alongside the per-category breakdown.

---

### Requirement 9: Data Persistence

**User Story:** As a user, I want my data to be saved automatically so that I don't lose my expense records when I close or refresh the browser.

#### Acceptance Criteria

1. WHEN a transaction is added, THE App SHALL write the updated transaction list to Local_Storage such that reading the same Local_Storage key immediately after returns the updated list including the new transaction.
2. WHEN a transaction is deleted, THE App SHALL write the updated transaction list to Local_Storage such that reading the same Local_Storage key immediately after returns the updated list without the deleted transaction.
3. WHEN the Spending_Limit is updated, THE App SHALL write the new value to Local_Storage.
4. WHEN the App loads, THE App SHALL read all persisted data from Local_Storage and restore: the Transaction_List with all saved transactions, the Balance_Display reflecting the sum of those transactions, the Spending_Limit input field with the saved limit value, and the active theme.
5. IF Local_Storage is unavailable or a read/write operation fails, THEN THE App SHALL display a notification informing the user that data cannot be saved in this session, and the notification SHALL remain visible until the user explicitly dismisses it.

---

### Requirement 10: Technical Constraints Compliance

**User Story:** As a developer, I want the App to follow defined technical and structural constraints so that the codebase remains simple, maintainable, and portable.

#### Acceptance Criteria

1. THE App SHALL be implemented using HTML, CSS, and Vanilla JavaScript only, with no JavaScript frameworks or build tools required.
2. THE App SHALL contain exactly one CSS file located in the `css/` directory and exactly one JavaScript file located in the `js/` directory.
3. THE App SHALL function correctly in the latest stable release of Chrome, Firefox, Edge, and Safari at the time of testing, without requiring polyfills.
4. THE App SHALL require no backend server; all data operations SHALL be performed client-side using the browser's Local Storage API.
5. THE App SHALL load and become interactive — defined as the point at which the user can successfully submit a new transaction — within 3 seconds on a standard broadband connection (≥ 10 Mbps) with a cold browser cache.
