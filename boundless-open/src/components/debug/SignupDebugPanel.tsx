import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SignupTester } from '@/lib/signup-tester';
import { X } from 'lucide-react';

interface SignupDebugPanelProps {
  onClose: () => void;
}

export function SignupDebugPanel({ onClose }: SignupDebugPanelProps) {
  const [testing, setTesting] = useState(false);
  const [email, setEmail] = useState(`test-${Date.now()}@example.com`);
  const [password, setPassword] = useState('Test123456!');
  const [fullName, setFullName] = useState('Test User');
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [results, setResults] = useState<string>('');

  const handleRunTest = async () => {
    setTesting(true);
    setResults('Running test...\n');

    const tester = new SignupTester();
    
    try {
      const success = await tester.runFullTest(email, password, fullName, role);
      const testResults = tester.getResults();
      
      const resultText = testResults
        .map(r => `[${r.step}] ${r.success ? '✓' : '✗'} ${r.message}`)
        .join('\n');
      
      setResults(`${resultText}\n\n${success ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
    } catch (error) {
      setResults(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Signup Debug Panel</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="test-email">Email</Label>
            <Input
              id="test-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@example.com"
              disabled={testing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-password">Password</Label>
            <Input
              id="test-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={testing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-name">Full Name</Label>
            <Input
              id="test-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Test User"
              disabled={testing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as 'patient' | 'doctor')}>
              <SelectTrigger disabled={testing}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="patient">Patient</SelectItem>
                <SelectItem value="doctor">Doctor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleRunTest} 
            disabled={testing}
            className="w-full"
          >
            {testing ? 'Running Test...' : 'Run Signup Test'}
          </Button>
        </div>

        {results && (
          <div className="bg-muted p-4 rounded-lg font-mono text-sm whitespace-pre-wrap overflow-auto max-h-96">
            {results}
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
          <p className="font-semibold mb-2">How to use:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Modify email, password, name, and role if needed</li>
            <li>Click "Run Signup Test" to execute the full signup flow</li>
            <li>View results in the panel below</li>
            <li>Check browser console for detailed logs</li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
