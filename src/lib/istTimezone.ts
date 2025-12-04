/**
 * Timezone utility for Indian Standard Time (IST - UTC+5:30)
 * All appointments should use IST for consistency
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30

/**
 * Convert any date to IST and return as ISO string
 */
export const toIST = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Date(d.getTime() + (IST_OFFSET_MS - d.getTimezoneOffset() * 60000)).toISOString();
};

/**
 * Get current time in IST
 */
export const getCurrentISTTime = (): Date => {
  const now = new Date();
  return new Date(now.getTime() + (IST_OFFSET_MS - now.getTimezoneOffset() * 60000));
};

/**
 * Format date as IST string (e.g., "2025-11-30 2:30 PM IST")
 */
export const formatDateAsIST = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const istDate = new Date(d.getTime() + (IST_OFFSET_MS - d.getTimezoneOffset() * 60000));
  
  const dateStr = istDate.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const timeStr = istDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  
  return `${dateStr} ${timeStr} IST`;
};

/**
 * Format date for display (locale-aware with IST label)
 */
export const formatAppointmentDateIST = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const istDate = new Date(d.getTime() + (IST_OFFSET_MS - d.getTimezoneOffset() * 60000));
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };
  
  return istDate.toLocaleString('en-IN', options) + ' IST';
};

/**
 * Check if appointment time has passed (using IST)
 */
export const hasAppointmentPassed = (appointmentDate: string): boolean => {
  const appointmentTime = new Date(appointmentDate);
  const currentTime = getCurrentISTTime();
  return appointmentTime < currentTime;
};

/**
 * Get today's date in IST (YYYY-MM-DD format)
 */
export const getTodayIST = (): string => {
  const today = getCurrentISTTime();
  return today.toISOString().split('T')[0];
};

/**
 * Check if a date string is today (in IST)
 */
export const isDateTodayIST = (dateStr: string): boolean => {
  return dateStr === getTodayIST();
};

/**
 * Filter time slots for today (remove past times in IST)
 */
export const filterPastTimeSlots = (dateStr: string, timeSlots: Array<{ value: string; label: string }>): Array<{ value: string; label: string }> => {
  if (!isDateTodayIST(dateStr)) {
    return timeSlots;
  }

  const currentTime = getCurrentISTTime();
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  return timeSlots.filter((slot) => {
    const [slotHour, slotMinute] = slot.value.split(':').map(Number);
    
    // Compare times
    if (slotHour > currentHour) return true;
    if (slotHour === currentHour && slotMinute > currentMinute) return true;
    
    return false;
  });
};
