import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

export const MicrophoneTroubleshooter: React.FC = () => {
  const [testResults, setTestResults] = useState<any>({});
  const [isTestingBrowser, setIsTestingBrowser] = useState(false);
  const [isTestingPermissions, setIsTestingPermissions] = useState(false);

  const testBrowserSupport = async () => {
    setIsTestingBrowser(true);
    const results: any = {};

    // Check if getUserMedia is available
    results.getUserMediaSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    
    // Check if running on secure context
    results.isSecureContext = window.isSecureContext;
    
    // Check current URL details
    results.protocol = window.location.protocol;
    results.hostname = window.location.hostname;
    results.port = window.location.port;
    results.fullUrl = window.location.href;
    
    // Check browser
    const userAgent = navigator.userAgent;
    results.browser = 'Unknown';
    if (userAgent.includes('Chrome')) results.browser = 'Chrome';
    else if (userAgent.includes('Firefox')) results.browser = 'Firefox';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) results.browser = 'Safari';
    else if (userAgent.includes('Edge')) results.browser = 'Edge';
    
    // Check if localhost
    results.isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    
    setTestResults(results);
    setIsTestingBrowser(false);
  };

  const testPermissions = async () => {
    setIsTestingPermissions(true);
    const results = { ...testResults };

    try {
      // Check current permissions
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'microphone' as any });
        results.permissionState = permission.state;
      }
    } catch (err) {
      results.permissionError = 'Cannot check permissions';
    }

    try {
      // Try to get devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      results.audioDevicesFound = audioInputs.length;
      results.hasLabels = audioInputs.some(device => device.label !== '');
    } catch (err: any) {
      results.deviceError = err.message;
    }

    setTestResults(results);
    setIsTestingPermissions(false);
  };

  const testMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      alert("✅ SUCCESS! Microphone access granted!");
      stream.getTracks().forEach(track => track.stop());
    } catch (err: any) {
      alert(`❌ FAILED: ${err.name} - ${err.message}`);
    }
  };

  const renderResult = (label: string, value: any, isGood?: boolean) => {
    const icon = isGood === true ? <CheckCircle className="w-4 h-4 text-green-500" /> :
                 isGood === false ? <XCircle className="w-4 h-4 text-red-500" /> :
                 <Info className="w-4 h-4 text-blue-500" />;
    
    return (
      <div className="flex items-center justify-between py-1">
        <span className="text-sm">{label}:</span>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-mono">{String(value)}</span>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Microphone Troubleshooter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={testBrowserSupport} disabled={isTestingBrowser} size="sm">
            {isTestingBrowser ? 'Testing...' : 'Test Browser'}
          </Button>
          <Button onClick={testPermissions} disabled={isTestingPermissions} size="sm">
            {isTestingPermissions ? 'Testing...' : 'Test Permissions'}
          </Button>
          <Button onClick={testMicrophone} variant="destructive" size="sm">
            Test Microphone
          </Button>
        </div>

        {Object.keys(testResults).length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <h4 className="font-medium">Diagnostic Results:</h4>
            
            {testResults.getUserMediaSupported !== undefined && 
              renderResult("getUserMedia Support", testResults.getUserMediaSupported, testResults.getUserMediaSupported)}
            
            {testResults.isSecureContext !== undefined && 
              renderResult("Secure Context", testResults.isSecureContext, testResults.isSecureContext)}
            
            {testResults.isLocalhost !== undefined && 
              renderResult("Is Localhost", testResults.isLocalhost, testResults.isLocalhost)}
            
            {testResults.protocol && 
              renderResult("Protocol", testResults.protocol)}
            
            {testResults.hostname && 
              renderResult("Hostname", testResults.hostname)}
            
            {testResults.port && 
              renderResult("Port", testResults.port)}
            
            {testResults.browser && 
              renderResult("Browser", testResults.browser)}
            
            {testResults.permissionState && 
              renderResult("Permission State", testResults.permissionState, testResults.permissionState === 'granted')}
            
            {testResults.audioDevicesFound !== undefined && 
              renderResult("Audio Devices", testResults.audioDevicesFound, testResults.audioDevicesFound > 0)}
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <h4 className="font-medium text-yellow-800 mb-2">Quick Fixes for NotAllowedError:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-700">
            <li>Make sure you're accessing via: <code className="bg-yellow-100 px-1 rounded">http://localhost:8080</code></li>
            <li>Look for a microphone icon in your browser's address bar and click "Allow"</li>
            <li>Clear browser data: Settings → Privacy → Clear browsing data</li>
            <li>Check browser permissions: Settings → Privacy → Site Settings → Microphone</li>
            <li>Try a different browser (Chrome usually works best)</li>
            <li>Restart your browser completely</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};