// ============================================
// Constants - Events Tracker
// ============================================

// Template user ID - koristi se za "starter" podatke i suggestions
export const TEMPLATE_USER_ID = '00000000-0000-0000-0000-000000000000';

// Default time for historical imports (Excel)
export const DEFAULT_TIME = '09:00';

// Value column mapping for EAV pattern
export const VALUE_COLUMNS: Record<string, string> = {
  number: 'value_number',
  text: 'value_text',
  datetime: 'value_datetime',
  boolean: 'value_boolean',
  link: 'value_text',
  image: 'value_text',
};

// Mobile detection
export const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

// Camera detection (async)
export const hasCamera = async (): Promise<boolean> => {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.mediaDevices?.enumerateDevices) return false;
  
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some(device => device.kind === 'videoinput');
  } catch {
    return false;
  }
};
