import { FluteTrainer } from "@/components/FluteTrainer";
import { MicrophoneController } from "@/components/MicrophoneController";
import { MicrophoneTroubleshooter } from "@/components/MicrophoneTroubleshooter";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center py-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Echo Flute Flow</h1>
          <p className="text-lg text-gray-600">AI-Powered Flute Training Platform</p>
        </div>
        
        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Full Flute Trainer */}
          <div className="lg:col-span-1">
            <FluteTrainer />
          </div>
          
          {/* Microphone Controller Demo */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800">Microphone Access Demo</h2>
            <p className="text-gray-600">
              This demonstrates the basic microphone access functionality with real-time pitch detection.
            </p>
            <MicrophoneController />
            
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Troubleshooting</h3>
              <MicrophoneTroubleshooter />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
