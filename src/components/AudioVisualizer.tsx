import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isListening: boolean;
  audioLevel: number;
  isResponding: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isListening,
  audioLevel,
  isResponding,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, w * ratio);
      canvas.height = Math.max(1, h * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const centerY = h / 2;
      const amplitude = isListening ? Math.max(8, audioLevel * 90) : 6;
      const responseAmplitude = isResponding ? 50 : 0;

      // User wave (primary)
      if (isListening) {
        ctx.beginPath();
        ctx.strokeStyle = 'hsl(210, 80%, 55%)';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.85;
        for (let x = 0; x < w; x++) {
          const wave1 = Math.sin((x + Date.now() * 0.003) * 0.03) * amplitude;
          const wave2 = Math.sin((x + Date.now() * 0.006) * 0.02) * amplitude * 0.4;
          const y = centerY + wave1 + wave2;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // AI response wave (secondary)
      if (isResponding) {
        ctx.beginPath();
        ctx.strokeStyle = 'hsl(280, 60%, 65%)';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        for (let x = 0; x < w; x++) {
          const wave = Math.sin((x + Date.now() * 0.008) * 0.025) * responseAmplitude;
          const y = centerY + wave + 36;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Background flow lines
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = 'hsl(190, 70%, 45%)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const y = centerY + Math.sin((x + Date.now() * 0.001 + i * 120) * 0.01) * 18;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isListening, audioLevel, isResponding]);

  return (
    <div className="relative w-full h-40 backdrop-glass rounded-2xl overflow-hidden border border-border/50">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Overlay indicators */}
      <div className="absolute top-4 left-4 flex gap-3">
        {isListening && (
          <div className="flex items-center gap-2 text-sm text-wave-active">
            <div className="w-2 h-2 bg-wave-active rounded-full animate-pulse" />
            Listening
          </div>
        )}
        {isResponding && (
          <div className="flex items-center gap-2 text-sm text-wave-response">
            <div className="w-2 h-2 bg-wave-response rounded-full animate-pulse" />
            Responding
          </div>
        )}
      </div>

      {/* Flow state indicator */}
      <div className="absolute bottom-4 right-4">
        <div
          className={`px-3 py-1 rounded-full text-xs transition-flow ${
            isListening && isResponding
              ? 'bg-flow-responsive/20 text-flow-responsive border border-flow-responsive/30'
              : isListening
              ? 'bg-flow-active/20 text-flow-active border border-flow-active/30'
              : 'bg-flow-calm/20 text-flow-calm border border-flow-calm/30'
          }`}
        >
          {isListening && isResponding ? 'In Flow' : isListening ? 'Active' : 'Ready'}
        </div>
      </div>
    </div>
  );
};