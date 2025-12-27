# Call Button Visibility Analysis - Doctor & Patient History Cards

## Issues Found

### **CRITICAL ISSUE #1: `canProvideFeedback` is Blocking Call Button Display**

**Location:** 
- [DoctorAppointmentHistory.tsx](src/components/dashboard/DoctorAppointmentHistory.tsx#L467-L485)
- [PatientAppointmentHistory.tsx](src/components/dashboard/PatientAppointmentHistory.tsx#L612-L630)

**Problem:**
The call button is wrapped inside `{canProvideFeedback(appointment) && (...)}` condition. This means the entire button section only renders if the appointment has **PASSED**.

```tsx
// BLOCKING CODE - From DoctorAppointmentHistory.tsx line 467
{canProvideFeedback(appointment) && (
  <div className="pt-1 sm:pt-1.5 border-t border-primary/10 space-y-1 sm:space-y-1.5">
    <div className="flex gap-2 flex-wrap">
      {appointment.status === "approved" && canStartVideoCall(appointment.appointment_date) && (!appointment.consultation_type || appointment.consultation_type === 'online') && (
        <Button
          size="sm"
          onClick={() => {
            setSelectedAppointmentForVideo(appointment);
            setVideoChatOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 gap-1 h-8 text-xs"
        >
          <Video className="h-3 w-3" />
          Start Call
        </Button>
      )}
    </div>
    // ... feedback section
  </div>
)}
```

**Function Definition:**
```typescript
// src/lib/istTimezone.ts (line 321-325 in DoctorAppointmentHistory)
const canProvideFeedback = (appointment: Appointment) => {
  const appointmentDate = new Date(appointment.appointment_date);
  const now = new Date();
  // Allow feedback for completed appointments OR approved appointments that have passed
  return (appointment.status === "completed" || appointment.status === "approved") && appointmentDate < now;
};
```

**The Problem:**
- `canProvideFeedback` returns `true` only when: `appointmentDate < now` (appointment time has passed)
- The call button needs to be shown **30 minutes BEFORE** the appointment time
- But the entire button container is hidden if the appointment hasn't passed yet

---

### **CRITICAL ISSUE #2: Time Window Mismatch**

The `canStartVideoCall()` function allows calling **30 minutes before to 1 hour after** appointment:

```typescript
// src/lib/istTimezone.ts (line 129-140)
export const canStartVideoCall = (appointmentDate: string): boolean => {
  const appointmentTime = new Date(appointmentDate);
  const currentTime = getCurrentISTTime();
  
  const timeDifferenceMs = appointmentTime.getTime() - currentTime.getTime();
  const timeDifferenceMinutes = timeDifferenceMs / (1000 * 60);
  
  // Show button if within 30 minutes before appointment or up to 1 hour after start
  return timeDifferenceMinutes <= 30 && timeDifferenceMinutes >= -60;
};
```

But `canProvideFeedback` only returns true AFTER appointment passes:

```typescript
// BUG: Requires appointment to have already passed
return (appointment.status === "completed" || appointment.status === "approved") && appointmentDate < now;
```

This creates a **contradiction**:
- ❌ Can't show call button until appointment has passed (canProvideFeedback)
- ✅ But call button should be shown 30 minutes before (canStartVideoCall)

---

### **CRITICAL ISSUE #3: Layout Structure Problem**

The button layout in PatientAppointmentHistory has better structure, but still wrapped in `canProvideFeedback`:

```tsx
{canProvideFeedback(appointment) && (
  <div className="pt-1.5 sm:pt-2 border-t border-primary/10 space-y-1.5 sm:space-y-2">
    <div className="flex gap-2 flex-wrap">
      {appointment.status === "approved" && canStartVideoCall(appointment.appointment_date) && 
       (!appointment.consultation_type || appointment.consultation_type === 'online') && (
        <Button>Join Call</Button>
      )}
      {/* Feedback buttons */}
    </div>
  </div>
)}
```

Same issue: the entire div (including call button) is hidden until appointment passes.

---

## Root Cause Summary

| Component | Issue | Impact |
|-----------|-------|--------|
| DoctorAppointmentHistory | Call button wrapped in `canProvideFeedback` | ❌ Button hidden until after appointment time |
| PatientAppointmentHistory | Call button wrapped in `canProvideFeedback` | ❌ Button hidden until after appointment time |
| istTimezone.ts | Logic mismatch: `canProvideFeedback` vs `canStartVideoCall` | ❌ Button rendered but hidden by parent condition |

---

## Current Visibility Logic

### What SHOULD happen:
1. **-30 to 0 minutes**: Show call button (appointment approaching)
2. **0 to +60 minutes**: Show call button (during/after appointment)
3. **After +60 minutes**: Hide call button, show feedback section

### What ACTUALLY happens:
1. **-30 to 0 minutes**: ❌ Nothing shown (canProvideFeedback = false)
2. **0 to +60 minutes**: Show call button ✅
3. **After +60 minutes**: Show call button + feedback section ✅

---

## Solution

The call button rendering needs to be **separated** from the feedback section wrapper. The button should use its own condition based on `canStartVideoCall()` instead of being nested inside `canProvideFeedback()`.

### Fixed Structure:
```tsx
// Call button should be OUTSIDE or BEFORE canProvideFeedback block
{appointment.status === "approved" && canStartVideoCall(appointment.appointment_date) && 
 (!appointment.consultation_type || appointment.consultation_type === 'online') && (
  <Button className="bg-blue-600 hover:bg-blue-700 gap-1 h-8 text-xs">
    <Video className="h-3 w-3" />
    {/* Doctor: Start Call, Patient: Join Call */}
  </Button>
)}

// Then feedback section AFTER appointment passes
{canProvideFeedback(appointment) && (
  <div className="feedback-section">
    {/* Feedback buttons and history */}
  </div>
)}
```

