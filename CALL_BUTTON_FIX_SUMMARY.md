# Call Button Visibility - Fix Summary

## Problem Identified
The call button was **completely invisible** in both Doctor and Patient appointment history cards. The button only appeared after the appointment had already passed.

## Root Cause Analysis

### Issue #1: Button Hidden by Parent Condition ⚠️
The call button was nested inside a `{canProvideFeedback(appointment) && ...}` conditional that:
- Returns `true` only **AFTER** the appointment time has passed
- Hides the entire button section (and feedback section) while appointment is approaching

**Example (BEFORE FIX):**
```tsx
{canProvideFeedback(appointment) && (
  <div>
    {/* Call button was here - INVISIBLE until after appointment */}
    {appointment.status === "approved" && canStartVideoCall(appointment.appointment_date) && (
      <Button>Start Call</Button>
    )}
    {/* Feedback buttons */}
  </div>
)}
```

### Issue #2: Time Window Contradiction ⚠️
- `canStartVideoCall()`: Allows calling **30 minutes BEFORE to 1 hour AFTER** appointment
- `canProvideFeedback()`: Only shows after appointment has completely **PASSED**
- Result: Call button couldn't appear during the allowed time window

### Issue #3: Broken User Flow ⚠️
Users wanted to start calls 30 minutes before appointment but:
1. Button was hidden until after appointment passed
2. Feedback section only appears after appointment passed
3. Call window closes 1 hour after appointment starts
4. Users had no way to join calls when appointments were approaching

---

## Solution Implemented

### Changes Made

#### 1. DoctorAppointmentHistory.tsx
**Location:** Lines 467-488

**What Changed:**
- ✅ Moved call button **OUTSIDE** the `canProvideFeedback()` conditional
- ✅ Call button now uses **only** `canStartVideoCall()` condition
- ✅ Feedback section remains inside `canProvideFeedback()` conditional
- ✅ Proper visual separation: call button appears first, then feedback section below

**Before:**
```tsx
{canProvideFeedback(appointment) && (
  <div>
    {/* Call button hidden here */}
    {appointment.status === "approved" && canStartVideoCall(...) && (
      <Button>Start Call</Button>
    )}
    {/* Feedback */}
  </div>
)}
```

**After:**
```tsx
{/* Call button - shown 30 min before to 1 hour after appointment, regardless of feedback status */}
{appointment.status === "approved" && canStartVideoCall(appointment.appointment_date) && (!appointment.consultation_type || appointment.consultation_type === 'online') && (
  <div className="pt-1 sm:pt-1.5">
    <Button className="bg-blue-600 hover:bg-blue-700 gap-1 h-8 text-xs w-full sm:w-auto">
      <Video className="h-3 w-3" />
      Start Call
    </Button>
  </div>
)}

{canProvideFeedback(appointment) && (
  <div className="pt-1 sm:pt-1.5 border-t border-primary/10 space-y-1 sm:space-y-1.5">
    {/* Feedback section only */}
  </div>
)}
```

#### 2. PatientAppointmentHistory.tsx
**Location:** Lines 548-568

**What Changed:**
- ✅ Moved call button **OUTSIDE** the `canProvideFeedback()` conditional
- ✅ Removed duplicate call button from feedback section
- ✅ Prescriptions section placed BEFORE call button (proper order)
- ✅ Changed button label to "Join Call" (patient perspective)
- ✅ Full width button on mobile (`w-full sm:w-auto`)

**Before:**
```tsx
{canProvideFeedback(appointment) && (
  <div>
    {/* Call button was here - hidden */}
    {appointment.status === "approved" && canStartVideoCall(...) && (
      <Button>Join Call</Button>
    )}
    {/* Feedback */}
  </div>
)}
```

**After:**
```tsx
{/* Call button - shown 30 min before to 1 hour after appointment */}
{appointment.status === "approved" && canStartVideoCall(appointment.appointment_date) && (!appointment.consultation_type || appointment.consultation_type === 'online') && (
  <div className="pt-1.5 sm:pt-2">
    <Button className="bg-blue-600 hover:bg-blue-700 gap-1 h-8 w-full sm:w-auto">
      <Video className="h-3 w-3" />
      Join Call
    </Button>
  </div>
)}

{canProvideFeedback(appointment) && (
  <div className="pt-1.5 sm:pt-2 border-t border-primary/10 space-y-1.5 sm:space-y-2">
    {/* Feedback section only */}
  </div>
)}
```

---

## Visibility Timeline (AFTER FIX)

```
Appointment: 2:00 PM IST
Current: 1:30 PM IST (30 mins before)

Timeline:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1:30 PM: ✅ Call button visible
2:00 PM: ✅ Call button visible
2:45 PM: ✅ Call button visible (within 1 hour after)
3:01 PM: ❌ Call button hidden
         ✅ Feedback section visible
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Button Display Logic
```typescript
{appointment.status === "approved" &&           // Appointment must be approved
 canStartVideoCall(appointment.appointment_date) && // Within call window (±30/±60 mins)
 (!appointment.consultation_type || appointment.consultation_type === 'online') && // Must be online
 (
   // Doctor sees "Start Call" button
   // Patient sees "Join Call" button
 )}
```

### Feedback Display Logic
```typescript
{canProvideFeedback(appointment) &&  // Only after appointment has passed
 (
   // Show feedback section with ratings, comments, etc.
 )}
```

---

## Benefits of Fix

| Aspect | Before | After |
|--------|--------|-------|
| **Button Visibility** | ❌ Hidden before appointment | ✅ Visible 30 mins before |
| **User Experience** | ❌ Users can't join early | ✅ Users can join in advance |
| **Time Window** | ❌ Closed before feedback opens | ✅ Proper sequence |
| **Mobile Responsive** | ❌ Overlapping buttons | ✅ Full-width on mobile |
| **Visual Flow** | ❌ Confusing layout | ✅ Call first, feedback after |

---

## Files Modified

1. **src/components/dashboard/DoctorAppointmentHistory.tsx**
   - Lines 467-488: Moved call button outside canProvideFeedback wrapper
   - Added comment explaining button logic
   - Improved button styling

2. **src/components/dashboard/PatientAppointmentHistory.tsx**
   - Lines 548-568: Moved call button outside canProvideFeedback wrapper
   - Added comment explaining button logic
   - Added prescriptions section before call button
   - Changed button label to "Join Call"
   - Removed duplicate call button from feedback section

---

## Testing Checklist

- [ ] Load doctor history with upcoming approved appointment
- [ ] Verify "Start Call" button appears 30 mins before appointment
- [ ] Verify "Start Call" button appears during appointment (1 hour after start)
- [ ] Verify "Start Call" button hides after 1 hour has passed
- [ ] Verify feedback section appears after appointment time passes
- [ ] Load patient history with upcoming approved appointment
- [ ] Verify "Join Call" button appears 30 mins before appointment
- [ ] Verify "Join Call" button appears during appointment
- [ ] Verify "Join Call" button hides after 1 hour has passed
- [ ] Verify prescriptions section appears correctly
- [ ] Test with online and in-person appointments
- [ ] Test button responsiveness on mobile and desktop
- [ ] Verify console has no errors
- [ ] Test video chat dialog opens when button clicked

---

## Related Functions Reference

**canStartVideoCall()** - src/lib/istTimezone.ts (lines 129-140)
- Shows button 30 minutes before to 1 hour after appointment
- Used by both doctor and patient history

**canProvideFeedback()** - src/components/dashboard/*.tsx
- Shows feedback section only after appointment has passed
- Allows both doctor and patient to leave feedback

**hasAppointmentPassed()** - src/lib/istTimezone.ts
- Checks if appointment time has completely passed
- Uses IST timezone for consistency

