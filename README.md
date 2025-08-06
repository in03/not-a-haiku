# Not a Haiku

Not great at haikus?

No problem!

> Not-a-Haiku is an interactive haiku validator with real-time syllable validation using a hybrid ML + dictionary approach.

## Features

- 🎯 **Real-time syllable counting** - Instant feedback as you type
- 📖 **CMU Dictionary** - 126K+ words with accurate syllable counts  
- 🤖 **ML Fallback** - lightweight inference for partial/unknown words
- ✨ **Auto line breaks** - Automatically moves to next line at syllable limits
- 🔄 **Smart backspace** - Removes invalid words when over syllable count
- 💫 **Shake feedback** - Visual indication when syllable limits are exceeded
- 📱 **Works offline** - Validation is pure client-side thanks to ONNX.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Architecture

### Syllable Counting Strategy
- **Complete known words**: CMU Dictionary lookup (100% 🎯)
- **Partial or unknown words**: Fast bi-directional GRU for real-time typing feedback (95.8% 🎯)

### Performance
- **Dictionary**: ~2MB compressed JSON (126K words)
- **Validation**: <5ms typical response time
- **Memory**: ~10-20MB total including dictionary

### Components
- `HaikuEditor.svelte` - Main editor with syllable enforcement
- `Toast.svelte` - Success/error notifications  
- `syllable-counter.js` - Hybrid counting logic

## How It Works

1. **Title Input** - User enters haiku title
2. **Content Editing** - Real-time syllable validation as they type
3. **Auto Enforcement** - Prevents over-limit typing, auto line breaks
4. **Completion** - Submit button appears when valid 5-7-5 structure

The editor mimics the Phoenix LiveView version but runs entirely client-side for zero latency.