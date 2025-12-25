# Product Guidelines - IsoCity

## Visual Identity
- **Sprite Style:** Maintain the "detailed pre-rendered" isometric aesthetic. New assets should match the level of detail, lighting, and perspective of existing sprites (e.g., those found in `public/assets/buildings/`).
- **Color Palette:** Use a clean, professional color palette for the UI that complements the game world without being overly distracting.
- **Consistency:** Ensure all visual elements (icons, buttons, grid indicators) feel like part of a unified whole.

## Communication & Tone
- **Voice:** Professional and informative. Descriptions should be clear, concise, and technically accurate regarding simulation logic.
- **Advisor Tone:** While "Vinnie" may be used, messages should be helpful and direct rather than purely humorous.
- **Instructional Clarity:** Prioritize clarity over fluff in all tutorials and help text.

## User Interface Design
- **Visual Hierarchy:** Essential information (current mode, money, population) should be immediately prominent. Secondary data should be accessible but not clutter the primary view.
- **Consistency:** Interaction patterns (e.g., click-and-drag for placement, right-click to cancel) must be uniform across all tools.
- **Responsive Layout:** UI elements should adapt gracefully to different screen sizes, with a specific focus on maintaining usability on mobile devices.

## Interaction & Feedback
- **Immersive Feedback:** Use subtle animations (e.g., tile highlights, building placement effects) and sound cues to confirm player actions.
- **Explicit Notifications:** Use UI toasts or dialogs for critical errors (e.g., "Insufficient Funds") or high-priority game events.
- **Shortcut Discoverability:**
    - Provide keyboard shortcut hints within tooltips for all relevant UI buttons.
    - Maintain a centralized "Keyboard Shortcuts" panel for easy reference.

## Design Constraints
- **Performance:** UI and rendering logic must remain highly performant, especially when handling large cities with many autonomous agents.
- **Accessibility:** Ensure high contrast for text and clear visual indicators for interactive elements.
