# Spec: UI Navigation and Keyboard Shortcut Discoverability

## Overview
This track aims to improve the user experience of IsoCity by making the application easier to navigate and its advanced features more discoverable. The primary focus is on keyboard shortcut awareness and clear visual feedback for game modes.

## Functional Requirements

### 1. Keyboard Shortcut Discoverability
- **Shortcut Help Panel:** A new UI component (accessible via a '?' icon or 'H' key) that lists all active keyboard shortcuts grouped by category (General, Build, View).
- **Contextual Tooltips:** All actionable UI buttons (in Sidebar, TopBar, and Mobile Toolbar) must display their corresponding keyboard shortcut in their tooltip (e.g., "Build Road (R)").

### 2. Mode Indication
- **Visual Feedback:** The UI must clearly indicate the current interaction mode (e.g., Build Road, Demolish, Inspect).
- **Status Indicator:** Add a persistent "Current Mode" indicator in the TopBar or near the cursor that updates dynamically.
- **Cursor State:** Update the cursor or provide a ghost image on the grid that reflects the current tool/mode.

### 3. Navigation Enhancements
- **Escape to Reset:** Ensure the 'Escape' key consistently resets the current mode back to "Select/Inspect".
- **Focus Management:** Improve keyboard focus so that UI panels can be closed with 'Escape' without losing game state.

## Non-Functional Requirements
- **Performance:** Tooltips and UI updates must not impact the 60fps rendering of the game canvas.
- **Accessibility:** Shortcut information should be available to screen readers via appropriate ARIA labels.
- **Mobile Support:** Tooltips should be handled gracefully (e.g., long-press or tap to see help) or omitted in favor of a dedicated help button.

## Success Criteria
- [ ] Users can view all keyboard shortcuts via a single click or keypress.
- [ ] Every UI button with a shortcut displays that shortcut in its tooltip.
- [ ] The current mode is clearly visible at all times.
- [ ] Keyboard navigation (Esc to cancel) works consistently.
