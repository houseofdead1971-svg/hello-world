import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Complete signup flow testing and debugging utility
 */

export interface SignupTestResult {
  step: string;
  success: boolean;
  message: string;
  error?: any;
  timestamp: string;
}

export class SignupTester {
  private results: SignupTestResult[] = [];

  private addResult(step: string, success: boolean, message: string, error?: any) {
    const result: SignupTestResult = {
      step,
      success,
      message,
      error,
      timestamp: new Date().toISOString(),
    };
    this.results.push(result);
    console.log(`[${step}] ${success ? '✓' : '✗'} ${message}`, error);
  }

  /**
   * Test basic Supabase connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      this.addResult('Connection', true, 'Supabase connection successful');
      return true;
    } catch (error) {
      this.addResult('Connection', false, 'Supabase connection failed', error);
      return false;
    }
  }

  /**
   * Test auth signup
   */
  async testAuthSignup(email: string, password: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error('No user returned from signup');

      this.addResult('Auth Signup', true, `User created: ${data.user.id}`);
      return data.user.id;
    } catch (error) {
      this.addResult('Auth Signup', false, 'Auth signup failed', error);
      return null;
    }
  }

  /**
   * Test profile creation
   */
  async testProfileCreation(userId: string, fullName: string, email: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .insert([{
          id: userId,
          full_name: fullName,
          email: email,
        }]);

      if (error) throw error;
      this.addResult('Profile Creation', true, 'Profile created successfully');
      return true;
    } catch (error) {
      this.addResult('Profile Creation', false, 'Profile creation failed', error);
      return false;
    }
  }

  /**
   * Test role assignment
   */
  async testRoleAssignment(userId: string, role: 'patient' | 'doctor' | 'admin'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert([{ user_id: userId, role }]);

      if (error) throw error;
      this.addResult('Role Assignment', true, `Role '${role}' assigned successfully`);
      return true;
    } catch (error) {
      this.addResult('Role Assignment', false, 'Role assignment failed', error);
      return false;
    }
  }

  /**
   * Test doctor profile creation (if role is doctor)
   */
  async testDoctorProfileCreation(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('doctor_profiles')
        .insert([{
          user_id: userId,
          specialization: 'Test Specialization',
          license_number: 'TEST-12345',
        }]);

      if (error) throw error;
      this.addResult('Doctor Profile', true, 'Doctor profile created successfully');
      return true;
    } catch (error) {
      this.addResult('Doctor Profile', false, 'Doctor profile creation failed', error);
      return false;
    }
  }

  /**
   * Verify complete signup
   */
  async verifySignup(userId: string): Promise<boolean> {
    try {
      // Check profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', userId)
        .single();

      if (profileError) throw new Error(`Profile check failed: ${profileError.message}`);
      if (!profile) throw new Error('Profile not found');

      // Check role exists
      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (roleError) throw new Error(`Role check failed: ${roleError.message}`);
      if (!roles || roles.length === 0) throw new Error('No role assigned');

      this.addResult('Verification', true, `Signup verified - Profile: ${profile.full_name}, Role: ${roles[0].role}`);
      return true;
    } catch (error) {
      this.addResult('Verification', false, 'Signup verification failed', error);
      return false;
    }
  }

  /**
   * Run complete signup test
   */
  async runFullTest(
    email: string,
    password: string,
    fullName: string,
    role: 'patient' | 'doctor' = 'patient'
  ): Promise<boolean> {
    console.log('=== SIGNUP TEST STARTED ===');
    this.results = [];

    // Step 1: Test connection
    const connectionOk = await this.testConnection();
    if (!connectionOk) {
      console.error('Connection test failed, stopping');
      return false;
    }

    // Step 2: Test auth signup
    const userId = await this.testAuthSignup(email, password);
    if (!userId) {
      console.error('Auth signup failed, stopping');
      return false;
    }

    // Step 3: Test profile creation
    const profileOk = await this.testProfileCreation(userId, fullName, email);
    if (!profileOk) {
      console.error('Profile creation failed, stopping');
      return false;
    }

    // Step 4: Test role assignment
    const roleOk = await this.testRoleAssignment(userId, role);
    if (!roleOk) {
      console.error('Role assignment failed, stopping');
      return false;
    }

    // Step 5: If doctor, test doctor profile
    if (role === 'doctor') {
      const doctorOk = await this.testDoctorProfileCreation(userId);
      if (!doctorOk) {
        console.error('Doctor profile creation failed, stopping');
        return false;
      }
    }

    // Step 6: Verify complete signup
    const verifyOk = await this.verifySignup(userId);

    console.log('=== SIGNUP TEST COMPLETED ===');
    this.printResults();

    return verifyOk;
  }

  /**
   * Print test results
   */
  printResults(): void {
    console.table(this.results.map(r => ({
      Step: r.step,
      Status: r.success ? '✓ PASS' : '✗ FAIL',
      Message: r.message,
    })));

    const allPassed = this.results.every(r => r.success);
    console.log(`\n${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
  }

  /**
   * Export results as JSON
   */
  getResults(): SignupTestResult[] {
    return this.results;
  }

  /**
   * Clean up test data (delete user and related data)
   */
  async cleanup(userId: string): Promise<boolean> {
    try {
      console.log(`Cleaning up test data for user ${userId}`);
      
      // Delete from doctor_profiles
      await supabase.from('doctor_profiles').delete().eq('user_id', userId);
      
      // Delete from user_roles
      await supabase.from('user_roles').delete().eq('user_id', userId);
      
      // Delete from profiles
      await supabase.from('profiles').delete().eq('id', userId);
      
      // Note: Auth user deletion must be done via Supabase Admin API
      console.log('Test data cleanup completed (auth user must be deleted manually)');
      return true;
    } catch (error) {
      console.error('Cleanup failed:', error);
      return false;
    }
  }
}

/**
 * Quick test function for console usage
 */
export async function quickSignupTest() {
  const tester = new SignupTester();
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'Test123456!';
  const testName = 'Test User';

  const success = await tester.runFullTest(testEmail, testPassword, testName, 'patient');
  
  if (success) {
    toast.success('Signup test completed successfully!');
    console.log('Test results:', tester.getResults());
  } else {
    toast.error('Signup test failed. Check console for details.');
  }

  return success;
}
