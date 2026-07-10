# Requirements Document

## Introduction

The Expense & Budget Visualizer is a mobile-friendly, single-page web application that enables users to track daily spending without requiring a backend or complex setup. Built with plain HTML, CSS, and Vanilla JavaScript, it stores all data in the browser's LocalStorage. Users can log transactions, categorize spending, view a live pie chart, set spending limits, and review a monthly summary — all from a clean, fast, and responsive interface.

---

## Glossary

- **App**: The Expense & Budget Visualizer single-page web application
- **Transaction**: A single spending record consisting of an item name, amount, category, and timestamp
- **Category**: A classification label for a transaction (e.g., Food, Transport, Fun, or a user-defined custom label)
- **Balance**: The total sum of all transaction amounts currently stored
- **Chart**: The pie chart displaying spending distribution across categories
- **LocalStorage**: The browser's built-in client-side key-value storage API
- **Spending_Limit**: A user-configured monetary threshold for a category beyond which the App highlights overspending
- **Monthly_Summary**: An aggregated view of all transactions grouped by calendar month
- **Input_Form**: The UI form used to enter a new transaction
- **Transaction_List**: The scrollable UI component listing all recorded transactions
- **Category_Manager**: The UI component that allows users to add and manage custom categories

---

## Requirements

### Requirement 1: Transaction Input

**User Story:** As a user, I want to fill in a form with an item name, amount, and category, so that I can record a new spending transaction.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text field for the item name (maximum 100 characters), a numeric field for the amount (accepting positive decimal values), and a dropdown selector pre-populated with at least the default categories: Food, Transport, and Fun.
2. WHEN the user submits the Input_Form with all fields filled and the amount greater than zero, THE App SHALL add a new Transaction to the stored data and immediately reflect it in the Transaction_List, Balance, and Chart within 100ms.
3. IF the user submits the Input_Form with the item name field empty, THEN THE Input_Form SHALL display an inline validation error message reading "Item name is required" and SHALL NOT add a Transaction.
4. IF the user submits the Input_Form with the amount field empty, zero, or a negative value, THEN THE Input_Form SHALL display an inline validation error message reading "Amount must be greater than zero" and SHALL NOT add a Transaction.
5. IF the user submits the Input_Form with no category selected, THEN THE Input_Form SHALL display an inline validation error message reading "Please select a category" and SHALL NOT add a Transaction.
6. WHEN a Transaction is successfully added, THE Input_Form SHALL reset all fields to their default empty or placeholder state.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see a scrollable list of all my transactions, so that I can review what I have spent.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all stored Transactions, each showing the item name, formatted amount (two decimal places with currency symbol), category, and the date the transaction was added.
2. THE Transaction_List SHALL display Transactions in descending order of creation (most recently added first).
3. THE Transaction_List SHALL be scrollable when the number of Transactions exceeds the visible viewport height, without causing the rest of the page to scroll.
4. WHEN a new Transaction is added, THE Transaction_List SHALL update to show the new entry at the top of the list within 100ms without requiring a page reload.
5. WHEN the user activates the delete control for a Transaction, THE App SHALL remove that Transaction from LocalStorage and update the Transaction_List, Balance, and Chart within 100ms.
6. WHEN no Transactions are stored, THE Transaction_List SHALL display a placeholder message such as "No transactions yet."

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending balance at the top of the page, so that I always know how much I have spent in total.

#### Acceptance Criteria

1. THE App SHALL display the total Balance — defined as the sum of all stored Transaction amounts — in the topmost section of the page, above all Transaction list content, at all times.
2. THE App SHALL display the Balance formatted to two decimal places with a currency symbol (e.g., "$0.00").
3. WHEN a Transaction is added or deleted, THE App SHALL recalculate and re-render the Balance within 100ms of the operation completing.
4. WHEN no Transactions are stored, THE App SHALL display a Balance of "$0.00".

---

### Requirement 4: Spending Distribution Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can visually understand where my money goes.

#### Acceptance Criteria

1. THE App SHALL render a pie chart using Chart.js that displays the proportion of total spending for each Category that has at least one Transaction, with each slice labeled by category name and its percentage of total spending.
2. WHEN a Transaction is added, THE App SHALL update the Chart within 100ms to reflect the new spending distribution.
3. WHEN a Transaction is deleted, THE App SHALL update the Chart within 100ms to reflect the updated spending distribution.
4. WHEN all Transactions are deleted, THE App SHALL hide the Chart canvas and display a placeholder message such as "No data to display."
5. THE Chart SHALL assign a distinct color to each Category, and that color SHALL remain the same for a given Category across all updates within a session.
6. THE Chart SHALL display a legend mapping each Category name to its assigned color.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions, so that I do not lose my spending history when I close the tab.

#### Acceptance Criteria

1. WHEN a Transaction is added or deleted, THE App SHALL serialize the updated Transaction list as a JSON string and write it to LocalStorage under the key `"ebv_transactions"`.
2. WHEN the App initializes, THE App SHALL read the value stored at the key `"ebv_transactions"` from LocalStorage and render all previously stored Transactions in the Transaction_List, Balance, and Chart.
3. WHEN LocalStorage is unavailable, or the stored value at `"ebv_transactions"` is absent, is not valid JSON, or does not conform to the Transaction list structure (array of objects each with at minimum `id`, `name`, `amount`, and `category` fields), THE App SHALL initialize with an empty Transaction list and display a non-blocking warning message that does not prevent further interaction.
4. THE App SHALL also persist the custom Category list to LocalStorage under the key `"ebv_categories"` and restore it on initialization following the same read/write rules.
5. THE App SHALL persist Spending_Limit settings to LocalStorage under the key `"ebv_limits"` and restore them on initialization following the same read/write rules.

---

### Requirement 6: Custom Categories

**User Story:** As a user, I want to add my own spending categories beyond the defaults, so that I can organize my expenses in a way that fits my lifestyle.

#### Acceptance Criteria

1. THE Category_Manager SHALL provide a text input field (maximum 50 characters) and a submit button that allow the user to define a new Category label.
2. WHEN the user submits a new Category label that, when trimmed of leading and trailing whitespace and compared case-insensitively, does not already exist in the Category list, THE App SHALL add the label (stored as-entered) to the Category dropdown in the Input_Form and persist the updated Category list to LocalStorage.
3. IF the user submits a Category label that is empty or consists only of whitespace, THEN THE Category_Manager SHALL display an inline validation error reading "Category name cannot be empty" and SHALL NOT add a Category.
4. IF the user submits a Category label that, when trimmed and compared case-insensitively, already exists in the Category list, THEN THE Category_Manager SHALL display an inline validation error reading "Category already exists" and SHALL NOT add a duplicate.
5. WHEN the App initializes, THE App SHALL restore all previously saved custom Categories from LocalStorage so they appear in the Input_Form dropdown alongside the default categories.
6. WHEN saving a custom Category fails due to a LocalStorage write error, THE App SHALL display a non-blocking error message and retain the in-memory Category list for the current session.

---

### Requirement 7: Spending Limit Alerts

**User Story:** As a user, I want to set a spending limit per category and be alerted when I exceed it, so that I can stay within my budget.

#### Acceptance Criteria

1. THE App SHALL provide a configuration interface where the user can set a positive numeric Spending_Limit (greater than zero, up to two decimal places) for each Category.
2. WHEN the user submits a Spending_Limit value that is not a positive number, THE App SHALL display an inline validation error reading "Limit must be a number greater than zero" and SHALL NOT save the value.
3. WHILE the total spending for a Category equals or exceeds its Spending_Limit, THE App SHALL visually highlight all Transaction_List entries belonging to that Category and the corresponding Chart segment using a distinct warning color (e.g., red or amber) that differs from all non-warning colors.
4. WHEN a Transaction is added or deleted and the resulting category total crosses a Spending_Limit boundary (either entering or exiting the exceeded state), THE App SHALL update the highlighted state within 100ms.
5. WHEN the user updates a Spending_Limit value, THE App SHALL persist the new limit to LocalStorage under `"ebv_limits"` and immediately re-evaluate all Category totals against their limits, updating highlights within 100ms.
6. IF no Spending_Limit is set for a Category, THEN THE App SHALL NOT apply any warning highlighting to Transactions or Chart segments in that Category.
7. WHEN the user removes a Spending_Limit for a Category (clears the value), THE App SHALL remove the limit from storage and clear all warning highlights for that Category within 100ms.

---

### Requirement 8: Monthly Summary View

**User Story:** As a user, I want to view a summary of my spending grouped by month, so that I can understand my spending trends over time.

#### Acceptance Criteria

1. THE App SHALL provide a Monthly_Summary view, accessible via a dedicated navigation control, that groups Transactions by calendar month using the format YYYY-MM derived from each Transaction's stored timestamp.
2. WHEN the user opens the Monthly_Summary view, THE App SHALL display months in descending order (most recent first), and for each month SHALL show: the month label (YYYY-MM), a breakdown of total spending per Category (sorted descending by amount, ties broken alphabetically), and the overall monthly total (sum of all Transaction amounts for that month).
3. WHEN a Transaction is added or deleted, THE App SHALL update the Monthly_Summary data so that it reflects the current Transaction list the next time the view is opened or when the view is currently visible.
4. WHEN no Transactions exist for a given month, THE App SHALL NOT display that month in the Monthly_Summary view.
5. WHEN a Transaction belongs to a Category that has been deleted from the Category list, THE App SHALL group that Transaction under "Uncategorized" in the Monthly_Summary view.

---

### Requirement 9: Browser Compatibility and Responsiveness

**User Story:** As a user, I want the App to work well on any modern browser and on mobile devices, so that I can track expenses anywhere.

#### Acceptance Criteria

1. THE App SHALL render and function correctly on the current stable releases of Chrome, Firefox, Edge, and Safari without requiring any browser extensions, plugins, or build tools.
2. THE App SHALL apply a responsive layout so that all UI components — Input_Form, Transaction_List, Chart, Monthly_Summary, Category_Manager, and Spending_Limit configuration — are fully usable (no horizontal overflow, no overlapping elements, all controls reachable) on viewport widths from 320px to 2560px.
3. THE App SHALL complete initial load and render all stored data within 2 seconds when opened as a local `file://` URL on a device with a standard broadband connection and no throttling.
4. WHEN the user interacts with any UI control (form submission, deletion, limit update, category addition), THE App SHALL reflect the visual result within 100ms, producing no perceptible lag.
5. THE App SHALL not require a local development server; it SHALL function correctly when opened directly from the file system via a `file://` URL.

---

### Requirement 10: Code and File Structure

**User Story:** As a developer, I want the codebase to follow strict file organization rules, so that the project remains easy to maintain.

#### Acceptance Criteria

1. THE App SHALL contain exactly one stylesheet file, located at `css/style.css`; the `index.html` file SHALL NOT include any additional external `<link rel="stylesheet">` references to local files, nor any inline `<style>` blocks containing application styles.
2. THE App SHALL contain exactly one JavaScript file for application logic, located at `js/app.js`; the `index.html` file SHALL NOT include any additional external `<script src="...">` references to local JS files other than `js/app.js` and approved CDN libraries (e.g., Chart.js), nor any inline `<script>` blocks containing application logic.
3. WHEN the user opens `index.html` directly in a supported browser via a `file://` URL, THE App SHALL render all UI components, load stored data, and produce no console errors related to missing local resources.
4. THE `index.html` file SHALL reference `css/style.css` via a `<link rel="stylesheet" href="css/style.css">` tag and `js/app.js` via a `<script src="js/app.js">` tag, both using relative paths.
