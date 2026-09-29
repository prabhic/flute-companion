# 🎋 Raga Detection Integration Setup

Your Echo Flute Flow app now has **AI-powered raga detection** using the state-of-the-art models from the automatic-raga-recognition repository!

## 🚀 Quick Start

### Option 1: Full AI Detection (Recommended)
```bash
# 1. Start the raga detection server
cd raga-server
./start.sh

# 2. In another terminal, start your main app
npm run dev

# 3. Access the app at http://localhost:8080
```

### Option 2: Traditional Pattern Mode (Fallback)
If you don't want to set up the Python server, the app will automatically fall back to traditional raga pattern recognition.

Just run:
```bash
npm run dev
```

## 🎼 What's Changed

### New Features
- **🎋 Raga Recognition**: Detects 10 Carnatic ragas including Ānandabhairavi, Madhyamāvati, Kāṁbhōji
- **🎵 Cultural Responses**: Generates raga-appropriate musical responses instead of Western scales  
- **💫 Mood Detection**: Recognizes emotional context (devotional, joyful, peaceful, etc.)
- **🕰️ Time Awareness**: Shows traditional time associations (morning, evening, etc.)

### UI Improvements
- **RagaMood Component**: Replaces technical musical analysis with cultural context
- **Bansuri-Focused Language**: "Play a phrase on your bansuri" instead of generic flute
- **Indian Philosophy**: Emphasizes musical dialogue and traditional wisdom

## 🧠 How It Works

### AI Detection Flow
1. **Audio Capture**: Your bansuri playing is captured via microphone
2. **Feature Extraction**: Audio features are processed for the neural network
3. **Raga Classification**: GRU/LSTM models predict the most likely raga (88-98% accuracy)
4. **Cultural Response**: Traditional raga patterns generate appropriate musical responses
5. **Mood Display**: Shows raga name, emotional context, and time associations

### Supported Ragas
The AI models can detect these 10 Carnatic ragas:
- **Ānandabhairavi** - Morning devotional raga (similar to Hindustani Bhairavi)
- **Madhyamāvati** - Evening pentatonic raga  
- **Kāṁbhōji** - Joyful afternoon raga
- **Suraṭi** - Gentle flowing raga
- **Mukhāri** - Contemplative evening raga
- Plus 5 others: Varāḷi, Hussēnī, Aṭāna, Dēvagāndhāri, Bēgaḍa

## 🛠️ Technical Architecture

### Frontend (TypeScript/React)
- `src/services/ragaAI.ts` - Raga detection service with traditional fallback
- `src/hooks/useRagaAnalysis.ts` - React hook for real-time raga analysis  
- `src/components/RagaMood.tsx` - Cultural UI component for raga feedback

### Backend (Python/PyTorch) 
- `raga-server/app.py` - Flask API serving the trained neural networks
- Uses pre-trained GRU (2.4M params) and LSTM (3.09M params) models
- Provides `/predict_raga` endpoint for real-time classification

### Model Integration
- **Hybrid Approach**: Client-side traditional patterns + server-side AI for accuracy
- **Graceful Fallback**: Works without Python server using pattern recognition
- **Real-time Processing**: Optimized for low-latency musical interaction

## 🎵 Usage Tips

### For Best Results
1. **Quiet Environment**: Minimize background noise for accurate raga detection
2. **Clear Phrases**: Play distinct melodic phrases with pauses between them
3. **Traditional Playing**: Use authentic bansuri techniques (meend, gamak) for better recognition
4. **Allow Processing Time**: Give the AI a moment to analyze your phrase before continuing

### Testing the System
1. **"Test Audio" Button**: Verifies audio playback works
2. **"Force Response" Button**: Manually triggers AI response for debugging
3. **Console Logging**: Open browser dev tools to see detailed raga analysis

## 🔧 Troubleshooting

### Python Server Issues
```bash
# Check if server is running
curl http://localhost:5000/health

# Restart the server
cd raga-server
./start.sh
```

### Browser Audio Issues
- Ensure microphone permissions are granted
- Use localhost (not 127.0.0.1) for better browser compatibility
- Try refreshing the page if audio detection stops working

### Model Loading Problems
- Ensure the `raga-models/` directory is present with the `.pth` files
- Check Python dependencies: `pip install -r raga-server/requirements.txt`
- Verify PyTorch installation: `python -c "import torch; print(torch.__version__)"`

## 📊 Performance

### Accuracy Rates (from research)
- **GRU Model**: 89% chunk-wise accuracy, 2.4M parameters (faster)
- **LSTM Model**: Similar accuracy, 3.09M parameters (more robust)
- **Real-time Capable**: Sub-second inference for responsive musical interaction

### Browser Compatibility
- **Chrome/Edge**: Full support with Web Audio API
- **Firefox**: Full support
- **Safari**: Supported (may need HTTPS for microphone access)
- **Mobile**: Limited support due to audio processing requirements

## 🎋 Cultural Authenticity

The system now reflects authentic Indian classical music concepts:

- **Raga-based Responses**: Uses traditional Indian scales instead of Western pentatonic
- **Emotional Context**: Recognizes and responds to raga moods (peaceful, devotional, joyful)
- **Time Associations**: Shows traditional time-of-day associations for each raga
- **Natural Learning**: Emphasizes musical dialogue over technical precision

## 🚀 Next Steps

### Potential Enhancements
- **More Ragas**: Expand beyond 10 ragas to include popular Hindustani ragas
- **Ornament Detection**: Recognize meend (glides) and gamak (oscillations)
- **Tala Awareness**: Rhythmic pattern recognition and response
- **User Personalization**: Learn individual playing style and preferences

### Advanced Features
- **Real-time Raga Shifts**: Detect when user modulates between ragas
- **Microrhythm**: Respond to subtle timing variations
- **Breath Patterns**: Incorporate traditional bansuri breathing techniques
- **Seasonal Appropriateness**: Suggest ragas based on time of day/season

---

Your Bansuri companion is now ready for authentic Indian classical music interaction! 🎋✨