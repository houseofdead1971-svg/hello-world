# Doctor-Patient Assignment Troubleshooting Guide

## Issue: "No Patients Assigned Yet" After Approval

When you approve an appointment, the system should **automatically assign the patient to your profile**. If you see "No patients assigned yet" even after approving appointments, here's why and how to fix it.

---

## ✅ Why Auto-Assignment Should Work

When you click **"Approve"** on a pending appointment:

```
1. System checks if patient already assigned
   ↓
2. If NOT assigned → Creates new doctor_patients record
   ↓
3. Patient appears in your "Patients" list
   ↓
4. You can now manage patient profile
```

**Code Logic** (in AppointmentManagement.tsx):
```typescript
if (status === "approved" && targetAppointment) {
  // Check if already assigned
  const { data: existingRelation } = await supabase
    .from("doctor_patients")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("patient_id", targetAppointment.patient_id)
    .maybeSingle();

  // If not assigned, create assignment
  if (!existingRelation) {
    const { error } = await supabase
      .from("doctor_patients")
      .insert({
        doctor_id: doctorId,
        patient_id: targetAppointment.patient_id,
        status: "active"
      });
  }
}
```

---

## ❌ Why Assignment Might Fail

### 1. **RLS Policy Blocking Insert** (Most Common)
- **Problem**: Row Level Security (RLS) policy doesn't allow the insert operation
- **Symptom**: Approval succeeds, but patient not added to list
- **Solution**: Apply migration `20251227_fix_doctor_patients_rls.sql`

### 2. **Database Constraint Violation**
- **Problem**: Foreign key constraints or unique constraints
- **Symptom**: Silent failure, no error message shown
- **Solution**: Check database logs in Supabase dashboard

### 3. **Patient Record Doesn't Exist**
- **Problem**: Patient ID invalid or patient profile not created
- **Symptom**: "Failed to assign patient" error message
- **Solution**: Ensure patient account was created properly

### 4. **Doctor ID Mismatch**
- **Problem**: Wrong doctor ID being used
- **Symptom**: Assignment succeeds but shows wrong doctor's patients
- **Solution**: Check authentication (logout/login)

---

## 🔧 How to Fix It

### Step 1: Apply the RLS Fix Migration

**In Supabase Dashboard:**
1. Go to **SQL Editor**
2. Click **New Query**
3. Copy and paste the entire contents of:
   ```
   supabase/migrations/20251227_fix_doctor_patients_rls.sql
   ```
4. Click **Run**
5. You should see: `"RLS policies for doctor_patients table created successfully"`

**Or using Supabase CLI:**
```bash
supabase db push
```

### Step 2: Check Browser Console

When approving an appointment, check for errors:

1. Open **Browser DevTools** (Press `F12`)
2. Go to **Console** tab
3. Approve an appointment
4. Look for messages starting with:
   - ✅ `"Patient successfully assigned to doctor"`
   - ❌ `"Error assigning patient:"`
   - ℹ️ `"Patient already assigned to doctor"`

**Example Error Messages:**
```
Error assigning patient: {
  message: "Policy violation",
  code: "PGRST001"
}
```

### Step 3: Verify RLS Policies

**In Supabase Dashboard:**
1. Go to **Authentication → Policies**
2. Search for `doctor_patients`
3. You should see 4 policies:
   - ✅ "Doctors can view their assigned patients"
   - ✅ "Doctors can insert patient assignments"
   - ✅ "Doctors can update their patient records"
   - ✅ "Patients can view their doctor assignments"

**If policies are missing** → Run the migration above

---

## 📊 How to Check Patient Assignment Status

### Method 1: Supabase Dashboard
1. Go to **Table Editor**
2. Select `doctor_patients` table
3. Filter for your doctor ID
4. You should see one row per assigned patient

### Method 2: Direct Database Query
In **SQL Editor**, run:
```sql
SELECT * FROM doctor_patients 
WHERE doctor_id = '{your-doctor-id}'
ORDER BY created_at DESC;
```

### Method 3: Check in App
1. Go to **Doctor Dashboard → Patients**
2. Should show list of all assigned patients
3. If empty, no assignments were created

---

## 🔄 Manual Patient Assignment

If auto-assignment isn't working, you can manually assign a patient:

**In Supabase Dashboard:**
1. Go to **Table Editor**
2. Select `doctor_patients`
3. Click **Insert Row**
4. Fill in:
   - `doctor_id`: Your doctor account ID
   - `patient_id`: Patient's account ID
   - `status`: "active"
   - `notes`: (optional) "Manually assigned"
5. Click **Save**

**Find Your IDs:**
- Go to **profiles** table
- Find your row (full_name matches you)
- Copy the `id` column

---

## ⚠️ Common Problems & Solutions

### Problem: "Patient already assigned" message appears every time
**Solution**: This is normal! It means:
- Patient was assigned on first approval
- Subsequent approvals skip assignment (already exists)
- **No action needed** ✅

### Problem: Patient appears in assignment but not in Patients list
**Solution**: The Patients list has a filter:
1. Check if status is "active" (not "inactive")
2. Refresh page with Ctrl+F5
3. Check browser console for fetch errors

### Problem: Assignment created but no toast message shown
**Solution**: Check browser console:
1. Press F12 → Console
2. Filter for messages with "assign"
3. Look for success or error message

### Problem: Old appointments won't assign patients
**Solution**: Auto-assignment only works on NEW approvals
- For existing approved appointments, manually assign or re-approve

---

## 🧪 Testing Auto-Assignment

### Test Steps:
1. **Create a test patient account** (if needed)
2. **Patient books online appointment**
3. **Doctor sees appointment request**
4. **Doctor clicks "Approve"**
5. **Check Patients list** → Patient should appear
6. **Check browser console** → Should show success message

### Expected Flow:
```
Pending Appointment
       ↓
Doctor clicks "Approve"
       ↓
Toast: "Appointment approved and patient assigned!"
       ↓
Check Patients list
       ↓
✅ Patient appears in list
```

---

## 🔐 RLS Policy Details

### What Each Policy Does:

**1. Select Policy (View)**
```sql
-- Doctors can see their own patients
doctor_id = auth.uid()
```

**2. Insert Policy (Auto-Assign)**
```sql
-- Doctors can only insert assignments for themselves
doctor_id = auth.uid()
```

**3. Update Policy (Modify)**
```sql
-- Doctors can only update their own assignments
doctor_id = auth.uid()
```

**4. Select Policy (Patients)**
```sql
-- Patients can see which doctors are assigned to them
patient_id = auth.uid()
```

**Why This Matters:**
- Ensures security (doctors can't see other doctors' patients)
- Enables auto-assignment (doctor_id must match logged-in user)
- Prevents unauthorized modifications

---

## 📱 For Appointments Not Auto-Assigning

If some appointments auto-assign but others don't:

### Check These:
1. **Consultation Type**: Must be regular appointment (not emergency)
   - Emergency bookings have different assignment logic
   - Check `emergency_bookings` table instead

2. **Doctor ID**: Must match authenticated doctor
   - Verify you're logged in with correct account
   - Check browser console for auth errors

3. **Patient ID**: Must be valid user
   - Patient must have completed profile
   - Check `profiles` table for patient record

4. **Database Constraints**:
   - Check for duplicate entries
   - Verify foreign key references exist
   - Check unique constraints

---

## 🆘 Getting Help

### Collect This Information:
1. **Doctor ID**: Your ID from profiles table
2. **Patient ID**: The patient's ID
3. **Appointment ID**: The specific appointment
4. **Error Message**: Full text from browser console
5. **When It Happens**: Specific patient or all patients?

### Debug Commands (Browser Console):
```javascript
// Check localStorage auth
localStorage.getItem('sb-auth-token')

// Check current user
JSON.parse(localStorage.getItem('sb-auth-token'))?.user?.id
```

### Check Supabase Logs:
1. Go to Supabase Dashboard
2. **Database → Query Performance**
3. Look for failed insert queries on doctor_patients

---

## ✅ Verification Checklist

After applying the fix, verify everything works:

- [ ] RLS migration applied successfully
- [ ] No errors in browser console
- [ ] Can approve new appointments
- [ ] Patients appear in list after approval
- [ ] Toast shows success message
- [ ] Can view patient profiles
- [ ] Can update patient information
- [ ] Patient list updates in real-time

---

## 📞 Still Not Working?

1. **Clear cache**: Ctrl+Shift+Delete (browser cache)
2. **Logout/Login**: Refresh authentication
3. **Check database**: Verify table exists and has data
4. **Review logs**: Check Supabase logs for SQL errors
5. **Test with new patient**: Ensure not a one-off issue

**Contact support with:**
- Your doctor ID
- Specific patient IDs that aren't assigning
- Full error message from console
- Screenshot of the Patients list showing "No patients assigned yet"

---

## 📋 Related Files

- **Auto-assignment code**: `src/components/dashboard/AppointmentManagement.tsx`
- **RLS policy migration**: `supabase/migrations/20251227_fix_doctor_patients_rls.sql`
- **Doctor dashboard**: `src/pages/DoctorDashboard.tsx`
- **Database schema**: `src/integrations/supabase/types.ts`

---

## 🔗 Useful Resources

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Policies](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

*Last Updated: December 27, 2025*
