## ADDED Requirements

### Requirement: SpanNote duration overlay rendering
The system SHALL create a DOM overlay layer on the Perfetto timeline page that persistently displays duration labels for all non-temporary SpanNote entries. Each duration label SHALL show the time span (end - start) formatted with appropriate units (ns, µs, ms, s). The overlay SHALL be positioned above the timeline track area, aligned with the corresponding SpanNote's horizontal span.

#### Scenario: SpanNote created via Shift+M
- **WHEN** the user presses Shift+M in Perfetto to create a new SpanNote
- **THEN** a persistent duration label SHALL appear above the timeline within the next animation frame, displaying the SpanNote's duration in a human-readable format

#### Scenario: Multiple SpanNotes visible simultaneously
- **WHEN** multiple SpanNotes exist and their time ranges overlap the visible window
- **THEN** each SpanNote SHALL have its own independent duration label rendered in the overlay, each with the SpanNote's assigned color

#### Scenario: Temporary note excluded
- **WHEN** a Note with id `__temp__` exists (created by pressing `M` without Shift)
- **THEN** the overlay SHALL NOT render a duration label for that temporary note

### Requirement: Viewport synchronization
The system SHALL update all duration label positions in real-time as the user zooms, pans, or scrolls the Perfetto timeline. Position updates SHALL occur on every animation frame via `requestAnimationFrame`.

#### Scenario: User pans timeline horizontally
- **WHEN** the user pans the timeline left or right (drag, scroll, or keyboard navigation)
- **THEN** all visible duration labels SHALL update their horizontal positions to remain aligned with their corresponding SpanNote time ranges within the same rendering frame

#### Scenario: User zooms timeline
- **WHEN** the user zooms in or out on the timeline
- **THEN** all duration labels SHALL update both their horizontal positions and widths to reflect the new time-to-pixel scale, and the duration text SHALL remain centered within the visible portion of the span

#### Scenario: SpanNote scrolls out of visible window
- **WHEN** a SpanNote's entire time range is outside the current visible window
- **THEN** the corresponding duration label SHALL be hidden (not rendered)

#### Scenario: SpanNote partially visible
- **WHEN** a SpanNote's time range partially overlaps the visible window
- **THEN** the duration label SHALL still be displayed, positioned within the visible portion of the span

### Requirement: Note change detection
The system SHALL detect additions, removals, and modifications to SpanNotes and update the overlay accordingly.

#### Scenario: SpanNote added
- **WHEN** a new SpanNote is added to `trace.notes.notes`
- **THEN** a new duration label SHALL appear in the overlay within the next animation frame

#### Scenario: SpanNote removed
- **WHEN** a SpanNote is removed (e.g., user presses Delete on selected note)
- **THEN** the corresponding duration label SHALL be removed from the overlay within the next animation frame

#### Scenario: SpanNote color changed
- **WHEN** a SpanNote's color property is modified
- **THEN** the corresponding duration label's border/accent color SHALL update to match

### Requirement: Duration formatting
The system SHALL format SpanNote durations using appropriate time units based on magnitude.

#### Scenario: Nanosecond-range duration
- **WHEN** a SpanNote's duration is less than 1,000 ns
- **THEN** the label SHALL display the value in nanoseconds (e.g., "450 ns")

#### Scenario: Microsecond-range duration
- **WHEN** a SpanNote's duration is >= 1,000 ns and < 1,000,000 ns
- **THEN** the label SHALL display the value in microseconds with up to 2 decimal places (e.g., "12.34 µs")

#### Scenario: Millisecond-range duration
- **WHEN** a SpanNote's duration is >= 1,000,000 ns and < 1,000,000,000 ns
- **THEN** the label SHALL display the value in milliseconds with up to 2 decimal places (e.g., "16.67 ms")

#### Scenario: Second-range duration
- **WHEN** a SpanNote's duration is >= 1,000,000,000 ns
- **THEN** the label SHALL display the value in seconds with up to 2 decimal places (e.g., "1.23 s")

### Requirement: Visual consistency with Perfetto
The duration label overlay SHALL use visual styling consistent with Perfetto's native `TimeSelectionPanel` H-bar rendering.

#### Scenario: Label styling
- **WHEN** a duration label is rendered
- **THEN** it SHALL display as a horizontal bar with vertical end markers (H-bar shape), a semi-transparent background, and a centered duration text using a compact monospace-style font

#### Scenario: Color matching
- **WHEN** a duration label is rendered for a SpanNote with a specific color
- **THEN** the label's accent/border color SHALL match the SpanNote's assigned color

### Requirement: Toggle control via Popup
The system SHALL provide a toggle switch in the extension Popup's settings tab to enable or disable the persistent duration overlay.

#### Scenario: User enables persistent duration display
- **WHEN** the user toggles the "持久化时长显示" switch to ON in the Popup settings
- **THEN** the setting SHALL be persisted to `chrome.storage.sync` as `persistDuration: true`, and the overlay SHALL become active on the Perfetto page

#### Scenario: User disables persistent duration display
- **WHEN** the user toggles the "持久化时长显示" switch to OFF
- **THEN** the setting SHALL be persisted as `persistDuration: false`, and all persistent duration labels SHALL be removed from the Perfetto page

#### Scenario: Default state
- **WHEN** the extension is freshly installed with no stored settings
- **THEN** the persistent duration display SHALL be enabled by default (`persistDuration: true`)

### Requirement: Graceful degradation
The system SHALL degrade gracefully when required Perfetto APIs are unavailable.

#### Scenario: Notes API unavailable
- **WHEN** `trace.notes` or `trace.notes.notes` is not accessible
- **THEN** the overlay feature SHALL be silently disabled without errors, and a warning SHALL be logged to the console

#### Scenario: Timeline API unavailable
- **WHEN** `trace.timeline.visibleWindow` is not accessible
- **THEN** the overlay feature SHALL be silently disabled without errors, and a warning SHALL be logged to the console
