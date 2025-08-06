# 🚫 Not a Haiku 🍃

Not great at haikus?

No problem!

> Not-a-Haiku is an interactive haiku validator with real-time syllable validation using a hybrid ML + dictionary approach.

## Features

- 🎯 **Real-time syllable counting** - Instant feedback as you type
- 🤖 **ONNX ML Model** - 95.82% accurate syllable prediction for unknown words
- 📖 **CMU Dictionary** - 126K+ words with 100% accurate syllable counts  
- 🎊 **Dynamic UI** - Title changes from "Not a Haiku" to "It's a Haiku!" with confetti
- ✨ **Auto line breaks** - Automatically moves to next line at syllable limits
- 🔄 **Smart backspace** - Removes invalid words when over syllable count
- 💫 **Shake feedback** - Visual indication when syllable limits are exceeded
- 📱 **Works offline** - No server required, pure client-side
- 🎉 **Celebration effects** - Confetti to increase self esteem

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## 🏗️ Architecture

### Syllable Counting Strategy
- **Complete words**: CMU Dictionary lookup (100% accurate)
- **Partial/Unknown words**: ONNX neural network (95.82% accurate)
- **Fallback**: Basic vowel counting if ML fails

### Performance
- **Dictionary**: ~2MB compressed JSON (126K words)
- **ONNX Model**: ~31KB optimized for web
- **Validation**: <5ms typical response time
- **Memory**: ~10-20MB total including dictionary and model

### Components
- `HaikuEditor.svelte` - Main editor with syllable enforcement
- `Toast.svelte` - Success/error notifications  
- `onnx-syllable-counter.js` - ONNX-based counting logic

## How It Works

1. **Title Input** - User enters haiku title
2. **Content Editing** - Real-time syllable validation as they type
3. **Dynamic Feedback** - UI transforms when valid structure is achieved
4. **Auto Enforcement** - Prevents over-limit typing, auto line breaks
5. **Celebration** - Confetti and success messages when complete

## 🌐 Deployment

This project is configured for GitHub Pages deployment. The GitHub Actions workflow will automatically build and deploy on every push to main.

### Manual Deployment
```bash
# Build for production
pnpm build

# The build output will be in the `build/` directory
```

## 🧪 Testing

Visit `/test-onnx` to test the ONNX syllable counter functionality.

## 📝 License

MIT License - feel free to use this for your own projects!