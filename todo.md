# Development Roadmap

## 🚀 Core Features & Vision

### Social Sharing & Export
- [ ] **Social sharing functionality** - Enable users to share their haikus across platforms
- [ ] **Export functionality** - Simple ways to export haikus for external use
- [ ] **AI-generated haiku images** - Generate beautiful backgrounds and typography for visual sharing
- [ ] **GitHub "for the love of code" badge** - Register and display project badge in Readme
- [ ] **GitHub "for the love of code" badge** - Display FTLOC badge/hashtag in footer.

### Content Management & Discovery
- [x] **Enhanced grid view** - Make into a better content management system
  - [x] Advanced search and filtering capabilities
  - [x] Edit and delete functionality
  - [x] Modal view for longer content (etherees)
  - [x] Direct editor integration from grid view
  - [x] Fix task checkbox toggle not updating visually in grid view
- [x] **Unified search experience** - Consolidate search bar and Ctrl+K functionality into a single, intuitive modal interface

## 🔧 Technical Improvements

### AI Analysis System
- [ ] **Rating system overhaul**:
  - [x] Replace "5 out of 5 stars" text with visual star icons (grayed out for missing stars)
  - [ ] Integrate AI-generated encouragement messages ("You're a natural", "Great job") based on content quality
  - [ ] Implement consistent rating criteria for more reliable results
  - [ ] Detect and penalize derivative content (1 star for exact duplicates)
- [ ] **Tag management**:
  - [x] Rename "task categories" to "categories" for broader applicability
  - [ ] Add user tag management (+ button for adding, x button for removing)
  - [ ] Prioritize existing tags in AI suggestions before creating new ones
- [ ] **User experience**:
  - [x] Remove distracting animated sparkles
  - [x] Add edit button for resubmission after poor reviews

### Audio & Voice
- [ ] **Text-to-Speech improvements**:
  - [ ] Fix TTS voice ID configuration
  - [ ] Support both default voices and bring-your-own (BYO) options

### Syllable Detection
- [x] **ONNX model fixes**:
  - [x] Resolve GitHub deployment issues causing bad word detection
  - [x] Fix specific word detection errors:
    - [x] "One" incorrectly detected as two syllables
    - [x] "Clothes" consistently detected as two syllables
- [x] **Smart validation**:
  - [x] Prevent over-limit blocking on incomplete last words
  - [x] Handle partial word input gracefully (e.g., "CL" → "CLO")

## 🎨 UI/UX Polish

### Onboarding
- [ ] - Add a dismissable onboarding prompt for new users. Make it punchy, short, but flashy. Suggest sign in to GitHub for AI analysis and syncing benefits

### Layout & Navigation
- [x] **Content centering** - Improve page layout balance
- [x] **Title management** - Enable backspace to shrink content back to title input
  - [x] Note on this, when selecting all text and hitting backspace, this also triggers title input editing. It should not.
- [x] **Sticky validation state** - After adding debounced validation, the progress bar does not reset post-submission.
- [x] **Search interface** - Create hybrid modal with integrated text input, probably kill the bar.
- [ ] **Settings sadness** - Modifying settings clears any current haiku. It would be nice to save state.
- [ ] **Viewer Modal** - Implement viewer modal for viewing editing actions on grid items
  - [x] Editable tags (removable)
  - [ ] Add additional tags (search, create new)
  - [x] Edit, delete buttons
    - [ ] Edit button in viewer modal doesn't work
  - [x] Add delete button 

### Visual Design
- [x] **Tailwind UI fixes**:
  - [x] Resolve transparency and styling issues
  - [x] Fix blue outlines and spacing problems
  - [x] Correct settings pane corner radius inconsistencies
  - [x] Toast appears over the navbar, blocking text and buttons. Display lower. Increase text contrast.
  - [x] Descenders of some letters are cut off on the lowest line.
- [x] **Settings toggles** - Fix non-functional AI analysis and TTS toggles (ensure business logic)

### TTS
- [x] Highlighting is pretty broken. Might consider removing and having play/pause only.
- [ ] Overlapping playback on multiple presses. Don't know why this is so hard to fix.

### Mobile
- [x] Autocomplete seems to cause counting and validation issues.
- [x] Auto newline not triggering on mobile devices.
- [x] Hide app feature bullets in footer on mobile and tablet.
- [ ] Multi-select not available for mobile
- [x] Responsiveness issues
 - [x] Worst for the grid view modal atm

## 🔄 System Integration

### Data Management
- [ ] **GitHub sync** - Resolve synchronization issues
 - [ ] Sync works more like backup atm. No "unsynced remote" awareness until sync fires.
 - [ ] Periodic sync logic missing.
- [x] **Task status management** - Implement task status change functionality