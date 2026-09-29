#!/bin/bash

echo "🎋 Setting up Raga Detection Server..."

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Install requirements
echo "📥 Installing Python dependencies..."
pip install -r requirements.txt

# Check if model files exist
if [ ! -f "../raga-models/models/gru_30_checkpoint.pth" ]; then
    echo "❌ GRU model file not found!"
    echo "Please ensure the raga-models directory is present with model files"
    exit 1
fi

if [ ! -f "../raga-models/models/lstm_25_checkpoint.pth" ]; then
    echo "❌ LSTM model file not found!"
    echo "Please ensure the raga-models directory is present with model files"
    exit 1
fi

echo "✅ Setup complete!"
echo "🚀 Starting Raga Detection Server..."
echo "📍 Server will be available at: http://localhost:5000"
echo ""

# Start the Flask server
python3 app.py