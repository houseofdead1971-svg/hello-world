# Signup Testing & Troubleshooting Guide

## Quick Test Steps

### Method 1: Manual Signup (Recommended First Test)
1. Go to Auth page (`/auth`)
2. Click "Don't have an account? Sign up"
3. **Step 1:**
   - Full Name: `Test User`
   - Email: `test+[timestamp]@example.com` (use unique email)
   - Password: `Test123456!`
   - Confirm Password: `Test123456!`
   - Role: Select `Patient`
4. Click "Continue to Step 2"
5. **Step 2:**
   - Date of Birth: Select any date
   - Gender: Select any option
   - Blood Type: Select any option
   - Emergency Contact: `Jane Doe, 555-1234`
   - Allergies: (optional - can leave blank)
   - Chronic Conditions: (optional - can leave blank)
6. Click "Complete Signup"

### Expected Behavior:
✓ Success toast: "Account created successfully!"
✓ Redirected to dashboard or prompted to sign in
✓ No error messages

### Method 2: Automated Debug Panel (Advanced)
1. On Auth page, press **`Ctrl + Shift + D`** to open debug panel
2. Modify test parameters if needed:
   - Email: Auto-generated unique email
   - Password: Test123456!
   - Full Name: Test User
   - Role: Patient or Doctor
3. Click "Run Signup Test"
4. View results in the panel

### Expected Test Results:
```
[Connection] ✓ Supabase connection successful
[Auth Signup] ✓ User created: [uuid]
[Profile Creation] ✓ Profile created successfully
[Role Assignment] ✓ Role 'patient' assigned successfully
[Verification] ✓ Signup verified - Profile: Test User, Role: patient
✓ ALL TESTS PASSED
```

## Common Issues & Solutions

### Issue 1: "This email is already registered"
**Cause:** Email already has an account
**Solution:** 
- Use a different email (try adding timestamp: `user+1234567890@example.com`)
- Or sign in with that email instead

### Issue 2: "Could not create user"
**Cause:** Supabase auth service issue
**Solution:**
- Check Supabase dashboard status
- Verify API key in `src/integrations/supabase/client.ts`
- Check browser console for WebSocket errors

### Issue 3: "Failed to create profile: duplicate key"
**Cause:** Profile already exists (fixed by recent update)
**Solution:**
- This should now be handled gracefully
- If still occurring, check database for orphaned profiles
- Use debug panel to see detailed error

### Issue 4: "Failed to assign role"
**Cause:** Role constraint or database issue
**Solution:**
- Check user_roles table constraints
- Verify role value is one of: 'patient', 'doctor', 'admin'
- Use debug panel to test individual steps

### Issue 5: "WebSocket connection failed" (realtime error)
**Cause:** Network issue, not critical for signup
**Solution:**
- This error is non-blocking (graceful fallback to polling)
- Check if behind VPN/proxy blocking WebSocket
- App will still work, just without real-time updates

## Browser Console Debugging

### To view detailed logs:
1. Open Browser DevTools (F12)
2. Go to Console tab
3. Perform signup action
4. Look for logs starting with: `[Signup]`, `[Auth]`, `[Profile]`, `[Role]`

### Example console output:
```
[Connection] ✓ Supabase connection successful
[Auth Signup] ✓ User created: 1edad835-957e-4f26-b0eb-8ba617b0bd3d
[Profile Creation] ✓ Profile created successfully
[Role Assignment] ✓ Role 'patient' assigned successfully
```

## Database Inspection (Admin)

### Check if user was created:
1. Supabase Dashboard > Authentication > Users
2. Search for test email
3. Check auth user exists

### Check if profile was created:
1. Supabase Dashboard > SQL Editor
2. Run: `SELECT * FROM profiles WHERE email = 'test@example.com';`
3. Should show 1 row

### Check if role was assigned:
1. Run: `SELECT * FROM user_roles WHERE user_id = 'user-uuid';`
2. Should show role entry

### Check if doctor profile exists (if doctor):
1. Run: `SELECT * FROM doctor_profiles WHERE user_id = 'user-uuid';`
2. Should show 1 row

## Automated Cleanup (If Needed)

After testing, to clean up test data from browser console:

```javascript
// Import the tester
import { SignupTester } from '@/lib/signup-tester';

// Create instance
const tester = new SignupTester();

// Clean up user (replace with actual user ID)
await tester.cleanup('1edad835-957e-4f26-b0eb-8ba617b0bd3d');
```

Note: Auth user deletion must be done via Supabase admin dashboard manually.

## Monitoring Real Issues

### If signup fails in debug panel:
1. Check console for detailed error logs
2. Screenshot error message
3. Note exact step where it fails
4. Check database state at that step
5. Review Supabase project logs

### Performance considerations:
- First signup might take 5-10 seconds (Supabase init)
- Subsequent signups should be 2-3 seconds
- If consistently slow, check network tab (F12 > Network)

## Success Indicators

✓ Auth user created (visible in Supabase dashboard)
✓ Profile record inserted
✓ User role assigned
✓ Can sign in with new credentials
✓ Dashboard loads without role errors
✓ User can see their data

## Next Steps After Success

1. Test sign in with new credentials
2. Test role-specific dashboard (patient vs doctor)
3. Test email verification (check email for link)
4. Test logout and re-login
5. Test navigation between pages
