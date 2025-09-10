# Development Roadmap

## 🚀 Core Features & Vision

### Social Sharing & Export
- [ ] **Social sharing functionality** - Enable users to share their haikus across platforms
- [ ] **Export functionality** - Simple ways to export haikus for external use
- [ ] **AI-generated haiku images** - Generate beautiful backgrounds and typography for visual sharing
- [ ] **GitHub "for the love of code" badge** - Register and display project badge

### Content Management & Discovery
- [ ] **Enhanced grid view** - Transform into a powerful content management system with:
  - [ ] Advanced search and filtering capabilities
  - [ ] Edit and delete functionality
  - [ ] Modal view for longer content (etherees)
  - [ ] Direct editor integration from grid view
- [ ] **Unified search experience** - Consolidate search bar and Ctrl+K functionality into a single, intuitive modal interface

## 🔧 Technical Improvements

### AI Analysis System
- [ ] **Rating system overhaul**:
  - [ ] Replace "5 out of 5 stars" text with visual star icons (grayed out for missing stars)
  - [ ] Integrate AI-generated encouragement messages ("You're a natural", "Great job") based on content quality
  - [ ] Implement consistent rating criteria for more reliable results
  - [ ] Detect and penalize derivative content (1 star for exact duplicates)
- [ ] **Tag management**:
  - [ ] Rename "task categories" to "categories" for broader applicability
  - [ ] Add user tag management (+ button for adding, x button for removing)
  - [ ] Prioritize existing tags in AI suggestions before creating new ones
- [ ] **User experience**:
  - [ ] Remove distracting animated sparkles
  - [ ] Add edit button for resubmission after poor reviews

### Audio & Voice
- [ ] **Text-to-Speech improvements**:
  - [ ] Fix TTS voice ID configuration
  - [ ] Support both default voices and bring-your-own (BYO) options

### Syllable Detection
- [ ] **ONNX model fixes**:
  - [x] Resolve GitHub deployment issues causing bad word detection
  - [ ] Fix specific word detection errors:
    - [ ] "One" incorrectly detected as two syllables
    - [ ] "Clothes" consistently detected as two syllables
- [ ] **Smart validation**:
  - [ ] Prevent over-limit blocking on incomplete last words
  - [ ] Handle partial word input gracefully (e.g., "CL" → "CLO")

## 🎨 UI/UX Polish

### Layout & Navigation
- [x] **Content centering** - Improve page layout balance
- [ ] **Title management** - Enable backspace to shrink content back to title input
- [ ] **Search interface** - Create hybrid modal with integrated text input

### Visual Design
- [ ] **Tailwind UI fixes**:
  - [ ] Resolve transparency and styling issues
  - [ ] Fix blue outlines and spacing problems
  - [ ] Correct settings pane corner radius inconsistencies
  - [ ] Tails of some lettersS are cut off on the lowest line.
- [x] **Settings toggles** - Fix non-functional AI analysis and TTS toggles (ensure business logic)

### TTS
- [ ] Highlighting is pretty broken. Might consider removing and having play/pause only.

## 🔄 System Integration

### Data Management
- [ ] **GitHub sync** - Resolve synchronization issues
- [ ] **Task status management** - Implement task status change functionality