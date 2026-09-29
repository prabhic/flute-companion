# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
- `npm run dev` - Start development server on port 8080 with hot reload
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run lint` - Run ESLint to check code quality
- `npm run preview` - Preview production build locally

### Environment Setup
- Uses **Node.js with npm** for package management (not Bun, despite bun.lockb presence)
- Development server runs on `localhost:8080` with IPv6 support (`::`)
- Microphone access requires localhost or HTTPS for browser security

## Architecture Overview

### Core Application Structure
This is an **AI-powered flute training application** built with React, TypeScript, and audio processing capabilities. The app provides real-time pitch detection, musical analysis, and AI-powered feedback for flute practice.

**Tech Stack:**
- **Frontend Framework:** Vite + React + TypeScript
- **UI Components:** shadcn/ui + Radix UI primitives 
- **Styling:** Tailwind CSS with custom audio/flow state color schemes
- **Audio Processing:** Web Audio API with real-time pitch detection
- **AI Integration:** OpenAI API for musical analysis and feedback
- **State Management:** React hooks with custom audio/musical analysis hooks

### Key Domain Concepts

**Audio Processing Flow:**
1. **Microphone Input** → Real-time audio stream capture
2. **Pitch Detection** → Frequency analysis using Web Audio API 
3. **Musical Analysis** → Pattern recognition and phrase analysis
4. **AI Feedback** → OpenAI-powered musical advice and suggestions

**Component Architecture:**
- **FluteTrainer** - Main training interface with audio engine
- **MicrophoneController** - Basic microphone access demo
- **MicrophoneTroubleshooter** - Diagnostic tools for audio issues
- **AudioVisualizer** - Real-time waveform and spectrum visualization
- **PitchIndicator** - Visual feedback for pitch accuracy
- **MusicalAdvice** - AI-generated practice suggestions

### Custom Hooks Architecture
- **useMicrophone** - Manages microphone permissions and stream access
- **usePitchDetector** - Real-time frequency detection using FFT analysis
- **useMusicalAnalysis** - Combines pitch data with AI analysis for feedback
- **useToast** - UI notifications for user feedback

### Services Layer
- **musicAI.ts** - OpenAI integration for musical phrase analysis
  - Fallback to rule-based analysis when API key not provided
  - Musical pattern recognition and practice recommendations

## Development Patterns

### Audio Processing Requirements
- **Real-time Performance:** Audio processing runs in requestAnimationFrame loops
- **Browser Security:** Microphone access requires user gesture and secure context
- **Resource Management:** Proper cleanup of audio contexts, streams, and analysis nodes
- **Error Handling:** Comprehensive permission and hardware error handling

### Component Patterns
- **Ref-based Audio Engine:** Audio contexts and nodes managed via useRef for persistence
- **State Separation:** UI state separate from audio processing state
- **Progressive Enhancement:** Basic functionality without API keys, enhanced with AI

### Custom Tailwind Theme
- **Audio Colors:** `wave-*` for waveform visualization colors
- **Flow State Colors:** `flow-*` for different practice session states  
- **Musical Feedback:** Custom color schemes for pitch accuracy feedback

## File Organization

```
src/
├── components/           # React components
│   ├── ui/              # shadcn/ui component library
│   ├── FluteTrainer.tsx # Main training interface
│   ├── MicrophoneController.tsx # Basic mic demo
│   ├── AudioVisualizer.tsx # Audio visualization
│   └── PitchIndicator.tsx # Pitch feedback UI
├── hooks/               # Custom React hooks
│   ├── useMicrophone.ts # Microphone access management
│   ├── usePitchDetector.ts # Real-time pitch detection
│   └── useMusicalAnalysis.ts # AI-powered analysis
├── services/            # External service integrations
│   └── musicAI.ts       # OpenAI musical analysis
├── pages/               # Route components
└── lib/                 # Utilities and configuration
```

## Important Notes

### Audio Development Considerations
- **Microphone Permissions:** Always handle getUserMedia() failures gracefully
- **Audio Context State:** Check audioContext.state before creating nodes
- **Cross-browser Compatibility:** Use AudioContext fallbacks for older browsers
- **Performance:** Limit FFT size and analysis frequency for real-time performance

### AI Integration
- **API Key Management:** OpenAI API key configurable in UI (not environment)
- **Graceful Degradation:** Application functions without API key using rule-based analysis
- **Rate Limiting:** Consider implementing request throttling for AI calls

### UI/UX Patterns
- **Permission Flows:** Clear user guidance for microphone access
- **Real-time Feedback:** Visual indicators for audio input levels and pitch accuracy
- **Responsive Design:** Works on desktop and tablet (mobile microphone limitations)

### TypeScript Configuration
- **Relaxed Settings:** `noImplicitAny: false` and `strictNullChecks: false` for rapid development
- **Path Aliases:** `@/*` maps to `./src/*` for clean imports
- **Unused Variables:** ESLint rule disabled (`@typescript-eslint/no-unused-vars: "off"`)