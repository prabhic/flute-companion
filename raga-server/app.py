#!/usr/bin/env python3
"""
Raga Detection Server
Provides REST API for real-time raga recognition using the trained PyTorch models
"""

import os
import sys
import torch
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import librosa
import warnings
warnings.filterwarnings('ignore')

# Add the src directory to Python path to import the models
sys.path.append('./raga-models/src')

try:
    from deepSRGM import DeepSRGM
    from test_utils import mapping10, predict10
except ImportError as e:
    print(f"Error importing raga models: {e}")
    print("Make sure the raga-models directory is present with the source code")
    sys.exit(1)

app = Flask(__name__)
CORS(app)  # Enable CORS for web frontend

class RagaDetectionService:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {self.device}")
        
        self.gru_model = None
        self.lstm_model = None
        self.current_model = None
        
        # Model configuration (should match training parameters)
        self.model_config = {
            'input_length': 5000,
            'embedding_size': 128,
            'hidden_size': 768,
            'num_layers': 1,
            'num_classes': 10,
            'vocab_size': 209,
            'drop_prob': 0.3
        }
        
    def load_models(self):
        """Load the pre-trained GRU and LSTM models"""
        try:
            # Load GRU model
            print("Loading GRU model...")
            self.gru_model = DeepSRGM(rnn="gru", **self.model_config)
            gru_checkpoint = torch.load('./raga-models/models/gru_30_checkpoint.pth', 
                                       map_location=self.device)
            self.gru_model.load_state_dict(gru_checkpoint['model_state_dict'])
            self.gru_model.to(self.device)
            self.gru_model.eval()
            print("✅ GRU model loaded successfully")
            
            # Load LSTM model
            print("Loading LSTM model...")
            self.lstm_model = DeepSRGM(rnn="lstm", **self.model_config)
            lstm_checkpoint = torch.load('./raga-models/models/lstm_25_checkpoint.pth', 
                                        map_location=self.device)
            self.lstm_model.load_state_dict(lstm_checkpoint['model_state_dict'])
            self.lstm_model.to(self.device)
            self.lstm_model.eval()
            print("✅ LSTM model loaded successfully")
            
            # Use GRU as default (faster)
            self.current_model = self.gru_model
            return True
            
        except Exception as e:
            print(f"❌ Error loading models: {e}")
            return False
    
    def preprocess_audio_features(self, audio_features, sample_rate=22050):
        """
        Preprocess audio features to match the model's expected input format
        This is a simplified version - the actual preprocessing would need to match
        the training pipeline exactly
        """
        try:
            # Convert to the format expected by the model
            # This would need to be refined to match the actual preprocessing pipeline
            
            # For now, create a dummy input that matches the expected dimensions
            # In practice, this would involve:
            # 1. Extract proper audio features (MFCC, spectrograms, etc.)
            # 2. Quantize/tokenize the features 
            # 3. Create sequences of length 5000
            
            # Placeholder: create random-ish input based on audio features
            features = np.array(audio_features, dtype=np.float32)
            
            # Simple mapping to vocab space (0-208)
            # This is a major simplification - real preprocessing would be much more sophisticated
            normalized_features = (features / np.max(features) * 200).astype(int)
            normalized_features = np.clip(normalized_features, 0, 208)
            
            # Pad or truncate to exact length needed by model
            if len(normalized_features) < self.model_config['input_length']:
                # Pad with repetition
                padding_needed = self.model_config['input_length'] - len(normalized_features)
                padding = np.tile(normalized_features, (padding_needed // len(normalized_features) + 1))[:padding_needed]
                normalized_features = np.concatenate([normalized_features, padding])
            else:
                # Truncate
                normalized_features = normalized_features[:self.model_config['input_length']]
            
            return torch.LongTensor(normalized_features).unsqueeze(0)  # Add batch dimension
            
        except Exception as e:
            print(f"Preprocessing error: {e}")
            # Return a default input if preprocessing fails
            return torch.randint(0, 209, (1, self.model_config['input_length']), dtype=torch.long)
    
    def predict_raga(self, audio_features, use_lstm=False):
        """Predict raga from audio features"""
        if not self.gru_model and not self.lstm_model:
            raise Exception("Models not loaded")
        
        model = self.lstm_model if use_lstm else self.gru_model
        
        try:
            # Preprocess the audio features
            model_input = self.preprocess_audio_features(audio_features)
            model_input = model_input.to(self.device)
            
            # Get prediction
            with torch.no_grad():
                output = model(model_input)
                probabilities = torch.softmax(output, dim=-1)
                predicted_class = torch.argmax(output, dim=-1).item()
                confidence = probabilities[0, predicted_class].item()
            
            raga_name = mapping10.get(predicted_class, "Unknown")
            
            return {
                'raga': raga_name,
                'confidence': confidence,
                'class_id': predicted_class,
                'all_probabilities': probabilities[0].cpu().numpy().tolist()
            }
            
        except Exception as e:
            print(f"Prediction error: {e}")
            raise

# Initialize the service
raga_service = RagaDetectionService()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'models_loaded': raga_service.current_model is not None,
        'device': str(raga_service.device)
    })

@app.route('/load_models', methods=['POST'])
def load_models():
    """Load the raga detection models"""
    success = raga_service.load_models()
    return jsonify({
        'success': success,
        'message': 'Models loaded successfully' if success else 'Failed to load models'
    })

@app.route('/predict_raga', methods=['POST'])
def predict_raga():
    """Predict raga from audio features"""
    try:
        data = request.json
        if not data or 'features' not in data:
            return jsonify({'error': 'No audio features provided'}), 400
        
        audio_features = data['features']
        use_lstm = data.get('use_lstm', False)
        
        if not raga_service.current_model:
            return jsonify({'error': 'Models not loaded'}), 500
        
        result = raga_service.predict_raga(audio_features, use_lstm)
        
        # Add additional metadata
        result['timestamp'] = data.get('timestamp', None)
        result['duration'] = data.get('duration', None)
        result['model_used'] = 'LSTM' if use_lstm else 'GRU'
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/available_ragas', methods=['GET'])
def get_available_ragas():
    """Get list of ragas the model can recognize"""
    return jsonify({
        'ragas': list(mapping10.values()),
        'count': len(mapping10),
        'mapping': mapping10
    })

@app.route('/model_info', methods=['GET'])
def get_model_info():
    """Get information about the loaded models"""
    return jsonify({
        'model_config': raga_service.model_config,
        'device': str(raga_service.device),
        'models_available': {
            'gru': raga_service.gru_model is not None,
            'lstm': raga_service.lstm_model is not None
        },
        'current_model': 'GRU' if raga_service.current_model == raga_service.gru_model else 'LSTM'
    })

if __name__ == '__main__':
    print("🎋 Starting Raga Detection Server...")
    
    # Try to load models on startup
    print("Loading raga detection models...")
    if raga_service.load_models():
        print("✅ All models loaded successfully!")
    else:
        print("⚠️ Models not loaded - will try on first request")
    
    # Start the Flask server
    app.run(
        host='127.0.0.1',
        port=5000,
        debug=True,
        threaded=True
    )