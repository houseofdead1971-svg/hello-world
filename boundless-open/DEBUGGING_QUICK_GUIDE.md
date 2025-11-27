# Quick Debugging Guide - Role Setup Error

## Immediate Actions If Issue Occurs

### 1. Enable Debug Console
```
Press: Ctrl + Shift + D (on Auth page)
```
This opens the SignupDebugPanel with real-time debugging info.

### 2. Check Browser Console
```
Press: F12 (open Developer Tools)
Go to: Console tab
```
Look for these logs:
- `[Auth] Signup complete`
- `[RoleRecovery] Starting recovery`
- `[RoleRecovery] Role found` or error messages

### 3. Common Error Messages & Solutions

#### Error: "Your account role not setup"
**Means**: Role not found in user_roles table

**Solution**:
1. Refresh the page
2. Sign out and sign in again
3. The recovery utility will auto-fix the role
4. If persists, contact support

**What's happening**: Browser is checking Dashboard before database synced. Refresh triggers recovery.

#### Error: "Failed to verify doctor status"
**Means**: Doctor role check failed

**Solution**:
1. Check if you have doctor role
2. Try signing out and back in
3. If error in profile creation, complete doctor details during signup
4. If persists, create/update doctor profile in database

#### Error: "Doctor profile setup incomplete"
**Means**: Doctor profile table has issues

**Solution**:
1. Doctor profile should auto-create
2. If not, the fallback in DoctorDashboard will create it
3. Reload the doctor dashboard page
4. If still fails, contact support

### 4. Manual Verification in Supabase

Go to Supabase Dashboard → SQL Editor, run:

```sql
-- Check user role
SELECT * FROM user_roles WHERE user_id = '<your-user-id>';

-- Check user profile
SELECT * FROM profiles WHERE id = '<your-user-id>';

-- Check doctor profile (if doctor)
SELECT * FROM doctor_profiles WHERE user_id = '<your-user-id>';
```

All three should have rows for a properly set up account.

### 5. Manual Recovery in Database

If role is truly missing, run in Supabase SQL Editor:

```sql
-- Get your user ID first
SELECT id FROM auth.users WHERE email = 'your-email@example.com';

-- Then pick the role you want (patient or doctor)
INSERT INTO user_roles (user_id, role) 
VALUES ('<user-id>', 'patient')
ON CONFLICT DO NOTHING;

-- If doctor, also create doctor profile
INSERT INTO doctor_profiles (user_id) 
VALUES ('<user-id>')
ON CONFLICT DO NOTHING;
```

## Step-by-Step Signup Debugging

### Step 1: Check Network
1. Open F12 → Network tab
2. Do signup
3. Look for requests to `auth/v1/signup` - should be 200
4. Look for database queries - should succeed

### Step 2: Check Console Logs
1. Open F12 → Console tab
2. Do signup
3. Look for `[Auth]` or `[RoleRecovery]` logs
4. Scroll to see complete signup flow logs

### Step 3: Check Role Assignment
After signup, run in browser console:
```javascript
const { data } = await supabase.from('user_roles').select('*');
console.log('All user roles:', data);
```

Your role should appear in the list.

### Step 4: Check Profile
After signup, run in browser console:
```javascript
const { data: { user } } = await supabase.auth.getUser();
const { data } = await supabase.from('profiles').select('*').eq('id', user.id);
console.log('Your profile:', data);
```

Your profile should appear.

## Performance Checks

### Signup Speed
- **Expected**: 3-5 seconds total
- **Too slow**: Check network latency, may need to increase delay

### Recovery Speed
- **Expected**: 1-2 seconds
- **Timeout**: Recovery is working, may just take longer

### Doctor Profile Creation
- **Expected**: Creates automatically via trigger
- **Check**: After 2 seconds, query doctor_profiles table

## Recovery Flow Diagram

```
Signup Complete
    ↓
Wait 2 seconds (DB sync)
    ↓
Sign in with credentials
    ↓
Query user_roles for role
    ↓
Role found? → YES → Navigate to dashboard ✓
    ↓ NO
Retry after 1 second
    ↓
Role found? → YES → Navigate ✓
    ↓ NO
Assign role from signup form
    ↓
Verify role assigned
    ↓
Navigate based on role ✓
```

## Database Trigger Verification

Check if trigger is working:

1. Go to Supabase → SQL Editor
2. Run:
```sql
SELECT tgname, tgrelname FROM pg_trigger 
WHERE tgname LIKE '%doctor%';
```

Should return: `trg_create_doctor_profile | user_roles`

3. If not found, the migration might not have run
4. Check migrations in Supabase dashboard

## Network Issues

### Slow Database
- Increase delay in Auth.tsx if needed: `setTimeout(resolve, 3000)`
- Recovery will automatically retry
- Check Supabase project health

### WebSocket Connection Failed
- This is non-critical
- Fallback to polling is automatic
- Check network tab for websocket errors
- Usually resolves itself

### No Internet
- Auth will fail with network error
- Recovery cannot run without connection
- Wait for connection and retry

## Logs to Collect for Support

If you need support, collect:

1. **Browser Console Output** (F12 → Console)
   - Look for all `[Auth]` and `[RoleRecovery]` logs
   - Copy paste the relevant errors

2. **Signup Form Data**
   - What role did you select?
   - What email/name did you enter?
   - Any special characters?

3. **Timing**
   - What time did signup fail?
   - How many times did you retry?
   - How long did it take?

4. **Database State** (from Supabase)
   ```sql
   SELECT * FROM user_roles WHERE user_id = '<your-user-id>';
   SELECT * FROM profiles WHERE id = '<your-user-id>';
   SELECT * FROM doctor_profiles WHERE user_id = '<your-user-id>';
   ```

5. **Browser Info**
   - Browser: Chrome/Firefox/Safari/etc
   - Version: (can check Help → About)
   - OS: Windows/Mac/Linux

## Quick Self-Service Fix

### If role is missing but you can access database:

```sql
-- Run in Supabase SQL Editor
WITH user_info AS (
  SELECT id FROM auth.users 
  WHERE email = 'your-email@example.com'
)
INSERT INTO user_roles (user_id, role)
SELECT id, 'patient' FROM user_info
ON CONFLICT DO NOTHING;
```

Then refresh your browser - you should have access.

### If you're a doctor and profile is missing:

```sql
-- First ensure role exists
WITH user_info AS (
  SELECT id FROM auth.users 
  WHERE email = 'your-email@example.com'
)
INSERT INTO user_roles (user_id, role)
SELECT id, 'doctor' FROM user_info
ON CONFLICT DO NOTHING;

-- Then create doctor profile
WITH user_info AS (
  SELECT id FROM auth.users 
  WHERE email = 'your-email@example.com'
)
INSERT INTO doctor_profiles (user_id)
SELECT id FROM user_info
ON CONFLICT DO NOTHING;
```

Then refresh your browser.

## Still Not Working?

1. **Clear browser cache**: Ctrl+Shift+Delete
2. **Hard refresh**: Ctrl+F5
3. **Sign out completely**: Click sign out in dashboard
4. **Try in incognito**: Private/incognito window
5. **Try different browser**: Eliminate browser-specific issues
6. **Wait a few minutes**: Some issues resolve themselves
7. **Contact support**: With the logs mentioned above
