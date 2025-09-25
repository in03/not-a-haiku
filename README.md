# Not a Haiku 🍃

A haiku writing app that validates syllable count in real-time and helps you turn tasks into poetry.

`#ForTheLoveOfCode`

**Live at: [haiku.trevatt.co](https://haiku.trevatt.co)**

## What It Does

*Not a Haiku* helps you write haikus (or other syllable-constrained poetry). It validates syllable count in real-time using fast dictionary lookup combined with a tiny client-side neural model. It also rates, critiques and tags your haikus using AI analysis powered by GitHub models.

<img src="https://github.com/user-attachments/assets/8271a417-5c9b-4142-a374-6f1d5e7ae0e4" width=640 height=384/>

> Real-time syllable counting and line validation

## Features

- 🎯 **Real-time syllable counting** - Instant feedback as you type
- 🤖 **ONNX ML Model** - 95.82% accurate syllable prediction for unknown words
- 📖 **CMU Dictionary** - 126K+ words with 100% accurate syllable counts  
- 🧠 **AI Analysis** - Rate, critique and categorize your poems using GitHub Models
- 🏷️ **Smart Tagging** - Automatic categorization and task tracking
- 🔍 **Content Management** - Search, edit, and organize your haikus
- ✨ **Multiple Poem Types** - Haiku, Tanka, Cinquain, Nonet, Etheree
- 🔄 **GitHub Sync** - Backup and sync across devices using GitHub Gist
- 🎉 **Celebration effects** - Confetti ofc

<img src="https://github.com/user-attachments/assets/5788a2f0-265a-4976-9d30-32eff5faeff6" width=640 height=384/>

> Supports multiple types of syllable constrained poetry

## Development

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

This project is configured via Vercel. With some work and some potentially limited features, deployment via GitHub Pages should also be possible using the static adapter.

### Manual Deployment
```bash
# Build for production
pnpm build

# The build output will be in the `build/` directory
```


## 📝 License

MIT License - feel free to use this for your own projects!
