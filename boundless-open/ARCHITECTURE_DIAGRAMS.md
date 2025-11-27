# Role Setup Fix - Architecture & Flow Diagrams

## 1. Signup Flow with Role Recovery

```
┌─────────────────────────────────────────────────────────────┐
│                    USER SIGNUP PAGE                          │
│                                                               │
│  Form: Email, Password, Role (patient/doctor)               │
│  Doctor-only: Specialization, License, Hospital             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              CREATE PROFILE RECORD                           │
│  INSERT into profiles (id, email, full_name, etc)           │
│  ✓ Returns immediately after INSERT                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              ASSIGN USER ROLE                               │
│  INSERT into user_roles (user_id, role)                    │
│  ✓ Role assignment successful                              │
│                                                             │
│  If doctor:                                                │
│    INSERT into doctor_profiles (user_id, specialization)  │
│    ✓ Or wait for trigger to create                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         ⏱️  WAIT 2 SECONDS FOR DATABASE SYNC               │
│                                                             │
│  Why? Supabase needs time to replicate data across         │
│  the database cluster. Without this wait, subsequent       │
│  reads might not see the written data.                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│           SIGN IN WITH EMAIL & PASSWORD                     │
│  supabase.auth.signInWithPassword(email, password)         │
│  ✓ Returns new session with user ID                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         VERIFY ROLE EXISTS IN DATABASE                      │
│  SELECT role FROM user_roles WHERE user_id = ?             │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │ Role found?                                      │     │
│  └──────────────────────────────────────────────────┘     │
│           │              │                                  │
│        YES │              │ NO                              │
│           │              │                                  │
│           ▼              ▼                                  │
│   ✓ Success         ⚠️ Recovery needed                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    (IF NO ROLE FOUND)
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         TRIGGER RECOVERY MECHANISM                          │
│                                                             │
│  1. Wait 1 second                                          │
│  2. Retry SELECT role FROM user_roles                      │
│  3. If still missing:                                      │
│     - Check profile for role field                         │
│     - Infer role (default: patient)                        │
│     - INSERT into user_roles                              │
│  4. Verify role now exists                                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         NAVIGATE TO APPROPRIATE DASHBOARD                   │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │ Role == "doctor" ?                               │     │
│  └──────────────────────────────────────────────────┘     │
│           │                          │                     │
│        YES│                          │ NO (patient)        │
│          ▼                          ▼                      │
│  /doctor-dashboard            /dashboard                  │
│  ✓ DoctorDashboard            ✓ Dashboard               │
│    • Load patients            • Load health stats       │
│    • Show appointments        • Show medications        │
│    • Doctor profile           • Show appointments       │
│    • Verify doctor_profiles   • Show records            │
└──────────────────────────────────────────────────────────┘
```

## 2. Role Recovery Utility Flow

```
┌──────────────────────────────────────────────────────────┐
│        recoverUserRole(userId)                           │
│                                                          │
│  Called when: Role not found in database                │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│  STEP 1: Check if role exists                           │
│  SELECT role FROM user_roles WHERE user_id = ?          │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Role exists?                                   │    │
│  └────────────────────────────────────────────────┘    │
│         │                            │                  │
│      YES│                            │ NO               │
│        ▼                            ▼                   │
│   Return role                  Continue to Step 2       │
│   ✓ DONE                                                │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│  STEP 2: Infer role from user profile                  │
│  SELECT role FROM profiles WHERE id = user_id           │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Profile.role exists?                           │    │
│  └────────────────────────────────────────────────┘    │
│         │                            │                  │
│      YES│                            │ NO               │
│        ▼                            ▼                   │
│   Use profile role          Default to "patient"        │
│                                                          │
│  inferredRole = profile?.role || "patient"             │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│  STEP 3: Assign inferred role to database              │
│  INSERT INTO user_roles (user_id, role)                │
│  VALUES (userId, inferredRole)                         │
│  ON CONFLICT DO NOTHING                                │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Insert successful?                             │    │
│  └────────────────────────────────────────────────┘    │
│         │                            │                  │
│      YES│                            │ NO (error)       │
│        ▼                            ▼                   │
│  Continue to Step 4      Return error to caller        │
│                          ✗ RECOVERY FAILED             │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│  STEP 4: If doctor, ensure doctor profile exists      │
│  IF inferredRole == "doctor":                          │
│    SELECT id FROM doctor_profiles WHERE user_id = ?   │
│                                                          │
│    ┌───────────────────────────────────────────────┐  │
│    │ Doctor profile exists?                        │  │
│    └───────────────────────────────────────────────┘  │
│           │                        │                   │
│        YES│                        │ NO                │
│          ▼                        ▼                    │
│    Continue to Step 5      INSERT into doctor_profiles │
│    (profile already exists) (create empty profile)     │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│  STEP 5: Return recovery result                         │
│  {                                                       │
│    success: true,                                       │
│    role: inferredRole,                                  │
│    message: "Role recovered and assigned: {role}"       │
│  }                                                       │
│  ✓ RECOVERY COMPLETE                                    │
└──────────────────────────────────────────────────────────┘
```

## 3. Dashboard Role Checking with Recovery

```
┌──────────────────────────────────────────────────────────┐
│          DASHBOARD COMPONENT MOUNTS                      │
│                                                          │
│  useEffect(() => {                                      │
│    checkUserSession(currentSession);                    │
│  }, [currentSession]);                                  │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  Get current user from Supabase                         │
│  If no user → redirect to /auth                         │
│                                                          │
│  setUser(currentSession.user)                           │
│  setSession(currentSession)                             │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  ATTEMPT 1: Direct role query                           │
│  SELECT role FROM user_roles WHERE user_id = ?          │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Query result?                                    │  │
│  └──────────────────────────────────────────────────┘  │
│         │              │              │                 │
│      Error│       Empty result│ Role found               │
│         │              │              │                 │
│         ▼              ▼              ▼                 │
│     Try recovery  Try recovery    ✓ Use role           │
└────────────────┬───────────────────────────────────────┘
                 │
                 ├─→ (ERROR or EMPTY RESULT)
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  ATTEMPT 2: Call recoverUserRole()                      │
│                                                          │
│  const recovery = await recoverUserRole(userId);       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Recovery successful?                             │  │
│  └──────────────────────────────────────────────────┘  │
│         │                            │                  │
│      YES│                            │ NO               │
│        ▼                            ▼                   │
│  Use recovered role          Show error & signout       │
│  Navigate to dashboard       ✗ DASHBOARD FAILED        │
│  ✓ DASHBOARD LOADED                                    │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  FINAL: Check role type                                │
│                                                          │
│  if (role === "doctor") {                              │
│    navigate("/doctor-dashboard");                       │
│  } else {                                              │
│    setUserRole(role);                                  │
│    fetchUserData(userId);                             │
│  }                                                      │
│                                                          │
│  ✓ DASHBOARD LOADED SUCCESSFULLY                       │
└──────────────────────────────────────────────────────────┘
```

## 4. DoctorDashboard Auth Check with Recovery

```
┌──────────────────────────────────────────────────────────┐
│        DOCTOR DASHBOARD COMPONENT MOUNTS                │
│                                                          │
│  useEffect(() => {                                      │
│    checkAuth();                                          │
│  }, []);                                                │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  Get authenticated user                                 │
│  const { data: { user } } = await supabase.auth.      │
│                                 getUser();              │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ User authenticated?                              │  │
│  └──────────────────────────────────────────────────┘  │
│         │                            │                  │
│      YES│                            │ NO               │
│        ▼                            ▼                   │
│  Continue to role check        Redirect to /auth       │
│                                 ✗ NOT AUTHORIZED       │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  VERIFY DOCTOR ROLE                                    │
│  SELECT role FROM user_roles WHERE user_id = ?        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Result?                                          │  │
│  └──────────────────────────────────────────────────┘  │
│         │              │              │                 │
│      Error│       Empty│ role="doctor"                  │
│         │              │              │                 │
│         ▼              ▼              ▼                 │
│    Try recovery  Try recovery    ✓ Continue            │
└────────────────┬───────────────────────────────────────┘
                 │
                 ├─→ (ERROR or EMPTY)
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  RECOVERY: Call recoverUserRole()                       │
│                                                          │
│  const recovery = await recoverUserRole(userId);      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ role === "doctor"?                               │  │
│  └──────────────────────────────────────────────────┘  │
│         │                            │                  │
│      YES│                            │ NO               │
│        ▼                            ▼                   │
│  Continue to profile check   Redirect to /dashboard    │
│                              (Not a doctor)             │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  VERIFY DOCTOR PROFILE EXISTS                          │
│  SELECT id FROM doctor_profiles WHERE user_id = ?      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Profile exists?                                  │  │
│  └──────────────────────────────────────────────────┘  │
│         │                            │                  │
│      YES│                            │ NO               │
│        ▼                            ▼                   │
│  Continue to load data      INSERT new doctor_profile  │
│  ✓ PROFILE OK              (or trigger already created)│
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  LOAD DOCTOR DATA                                       │
│  await Promise.all([                                    │
│    fetchDoctorName(userId),                            │
│    fetchPatients(userId),                              │
│    loadDoctorStats(userId),                            │
│    loadAvailability(userId)                            │
│  ]);                                                     │
│                                                          │
│  ✓ DOCTOR DASHBOARD LOADED                            │
└──────────────────────────────────────────────────────────┘
```

## 5. Database Trigger Flow

```
┌──────────────────────────────────────────────────────────┐
│  USER SIGNUP COMPLETES                                 │
│  INSERT INTO user_roles (user_id, role)                │
│  VALUES (?uuid, 'doctor')                              │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  TRIGGER FIRES: trg_create_doctor_profile              │
│  AFTER INSERT ON user_roles FOR EACH ROW               │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  TRIGGER FUNCTION: create_doctor_profile_on_assignment │
│                                                          │
│  IF NEW.role = 'doctor' THEN                           │
│    INSERT INTO doctor_profiles (user_id)               │
│    VALUES (NEW.user_id)                                │
│    ON CONFLICT (user_id) DO NOTHING                   │
│  END IF                                                 │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  DOCTOR PROFILE AUTO-CREATED                           │
│  ✓ Empty doctor_profile record inserted                │
│    (user_id, specialization='', created_at=now)       │
│                                                          │
│  If conflict (already exists):                         │
│  ✓ DO NOTHING (already has profile)                    │
│                                                          │
│  ✓ TRIGGER COMPLETE                                    │
└──────────────────────────────────────────────────────────┘
```

## 6. Error Recovery Timeline

```
Timeline of Role Setup with Recovery

T+0s     Sign up button clicked
         ├─ Create profile
         ├─ Assign role
         └─ Create doctor_profiles (if doctor)

T+1s     Signup form complete, show success toast
         └─ Show "Account created successfully! Signing in..."

T+1s     Wait 2 seconds (⏱️ DATABASE SYNC)
         └─ Ensures all writes are replicated

T+3s     Sign in with email/password
         └─ Get new session

T+3.5s   Query role_users table
         ├─ CASE A: Role found → ✓ Success, navigate
         └─ CASE B: Role missing → Try recovery

T+4s     (IF CASE B) Retry role query
         ├─ CASE B1: Found → ✓ Navigate
         └─ CASE B2: Still missing → Infer from profile

T+4.5s   (IF CASE B2) Infer role, INSERT new role
         └─ Verify insert succeeded

T+5s     Role verified, navigate to dashboard
         └─ ✓ COMPLETE (max 5 seconds total)
```

## 7. Error Recovery Decision Tree

```
Role Recovery Decision Tree

Is role missing?
│
├─ NO → ✓ Use role normally
│
└─ YES
   │
   ├─ Try to fetch role from database
   │  │
   │  ├─ Found? → ✓ Use it
   │  │
   │  └─ Not found?
   │     │
   │     ├─ Check if user has profile
   │     │  │
   │     │  ├─ Has profile? → Infer role from profile
   │     │  │  │
   │     │  │  ├─ Profile.role exists? → Use it
   │     │  │  └─ No? → Default to "patient"
   │     │  │
   │     │  └─ No profile? → Default to "patient"
   │     │
   │     ├─ Insert inferred role
   │     │  │
   │     │  ├─ Success? → ✓ Recovery complete
   │     │  └─ Failed? → ✗ Error
   │     │
   │     └─ If doctor, ensure doctor_profiles exists
   │        │
   │        ├─ Exists? → ✓ All good
   │        └─ Not exists? → Create it
```

## 8. Success Indicators

```
✓ SUCCESSFUL FLOW INDICATORS

Browser Console:
├─ No PGRST116 errors
├─ No "role not setup" errors
└─ "[RoleRecovery]" logs if recovery needed

Dashboard:
├─ User name shows correctly
├─ Health stats load
└─ Navigation works

Doctor Dashboard:
├─ Patients list shows
├─ Appointments show
└─ Doctor profile loads

Database:
├─ user_roles has entry for user
├─ profiles has entry for user
└─ doctor_profiles has entry (for doctors)
```

## 9. Troubleshooting Flowchart

```
Troubleshooting: "Role Not Setup" Error

Start: User sees error
│
├─ Check: Is this post-signup?
│  ├─ YES → Skip signup, go to dashboard access
│  └─ NO → Already signed in, go to dashboard access
│
├─ Dashboard Access Issue
│  │
│  ├─ Refresh page
│  │  ├─ Works? → ✓ FIXED (recovery worked)
│  │  └─ Still error? → Continue
│  │
│  ├─ Sign out → Sign back in
│  │  ├─ Works? → ✓ FIXED (recovery worked)
│  │  └─ Still error? → Continue
│  │
│  ├─ Check browser console for logs
│  │  ├─ "[RoleRecovery]" errors? → Recovery failed
│  │  ├─ Network errors? → Network issue
│  │  └─ No logs? → Silent error
│  │
│  ├─ Check Supabase database
│  │  ├─ SELECT * FROM user_roles WHERE user_id = ?
│  │  ├─ Found? → Role exists, UI issue
│  │  └─ Not found? → Role missing, need manual fix
│  │
│  └─ If not found, manual INSERT:
│     └─ INSERT INTO user_roles (user_id, role) VALUES (?, 'patient')
│
└─ ✓ Issue resolved
```

This comprehensive architecture ensures that even if the initial role assignment fails, the system will automatically detect and recover it.
