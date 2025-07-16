import { fileClient } from './fileClient';

// License interface
interface License {
  customer_id: string;
  max_runbooks: number;
  issued_at: number;
  expires_at: number;
  features: string[];
  signature: string;
}

interface LicenseValidationResult {
  valid: boolean;
  license?: License;
  error?: string;
}

interface RunbookUsage {
  current_count: number;
  max_allowed: number;
  remaining: number;
}

// Embedded public key for license verification (RSA 2048-bit)
// This is intentionally obfuscated to make tampering more difficult
const PUBLIC_KEY_SEGMENTS = [
  'LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0t',
  'LS0KTUlJQklqQU5CZ2txaGtpRzl3MEJB',
  'UUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUE5',
  'ZDJMQWFJSklEQmV6RGN0bTI3VwpBWUxV',
  'UEF4elZCMzQ1UlNFanA1MXpSZDRjVlpr',
  'ck9kcjJ2L0RvdzRhNGlJaWNuZTZnOWRZ',
  'bkN6ODUxbU9UN3g3CjR6RVNkSlpEYzdx',
  'OStSVlVNUlI0UzdOc2trY2lKVE9Wb0F0',
  'OUhLbnVjMVRSQlhiR0paOURJSmsyTVBo',
  'VFdlblEKNFZuYVdtTlNjTHQ4enJJUEI4',
  'a3VRWlJBS0ROdEZYa2VabkpLZEswOXZI',
  'SmZBZUN0Vk93RVBnNjc4VVdMSndKLwp6',
  'ZCsyYUE4REozYXdacURXNlZlcFNoVkhm',
  'VXFRRTlpZStoK1lXSGpRVlhwaHFCcmtD',
  'aGFxMEtLaGsrWjJOdHpkCkFWVzNtVkJj',
  'MXFvdFVSaXFsbzBrUXF3MVFwYzI2N2l5',
  'Mk9iSjBBbUJoVzZIYnBQRENJVDI2TnVE',
  'bFpGd000ZloKVndJREFRQUIKLS0tLS1F',
  'TkQgUFVCTElDIEtFWS0tLS0tCg==',
];


// Reconstruct public key (simple obfuscation)
const getPublicKey = (): string => {
  return atob(PUBLIC_KEY_SEGMENTS.join(''));
};

// License storage in localStorage (obfuscated key)
const LICENSE_STORAGE_KEY = btoa('vr_nav_license_2024');

// Helper function to get current timestamp
const getCurrentTimestamp = (): number => Math.floor(Date.now() / 1000);

// Validate license signature using Web Crypto API
async function validateLicenseSignature(licenseData: Omit<License, 'signature'>, signature: string): Promise<boolean> {
  try {
    // Debug logging
    const debugMode = localStorage.getItem('licensing_debug') === 'true';
    
    // Import the public key
    const publicKeyPem = getPublicKey();
    const pemHeader = "-----BEGIN PUBLIC KEY-----";
    const pemFooter = "-----END PUBLIC KEY-----";
    const pemContents = publicKeyPem.replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '');
    
    const binaryDerString = atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    const publicKey = await crypto.subtle.importKey(
      'spki',
      binaryDer,
      {
        name: 'RSA-PSS',
        hash: 'SHA-256',
      },
      false,
      ['verify']
    );

    // Create payload to verify
    const payload = JSON.stringify(licenseData);
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);

    if (debugMode) {
      console.log('License validation debug:');
      console.log('License data:', licenseData);
      console.log('Payload to verify:', payload);
      console.log('Signature length:', signature.length);
    }

    // Decode signature from base64
    const signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

    // Verify signature
    const isValid = await crypto.subtle.verify(
      {
        name: 'RSA-PSS',
        saltLength: 32, // SHA-256 digest length
      },
      publicKey,
      signatureBytes,
      data
    );

    if (debugMode) {
      console.log('Signature validation result:', isValid);
    }

    return isValid;
  } catch (error) {
    console.error('License signature validation failed:', error);
    return false;
  }
}

// Get stored license
function getStoredLicense(): License | null {
  try {
    const licenseStr = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (!licenseStr) return null;
    
    // Simple decoding (additional obfuscation layer)
    const decodedLicense = atob(licenseStr);
    return JSON.parse(decodedLicense);
  } catch (error) {
    console.error('Failed to retrieve license:', error);
    return null;
  }
}

// Store license
function storeLicense(license: License): void {
  try {
    // Simple encoding (additional obfuscation layer)
    const encodedLicense = btoa(JSON.stringify(license));
    localStorage.setItem(LICENSE_STORAGE_KEY, encodedLicense);
  } catch (error) {
    console.error('Failed to store license:', error);
  }
}

// Validate license
export async function validateLicense(): Promise<LicenseValidationResult> {
  const license = getStoredLicense();
  
  if (!license) {
    return { valid: false, error: 'No license found' };
  }

  const currentTime = getCurrentTimestamp();
  
  // Check expiration
  if (currentTime > license.expires_at) {
    return { valid: false, error: 'License expired' };
  }

  // Validate signature
  const { signature, ...licenseData } = license;
  const signatureValid = await validateLicenseSignature(licenseData, signature);
  
  if (!signatureValid) {
    return { valid: false, error: 'Invalid license signature' };
  }

  return { valid: true, license };
}

// Install license from license key string
export async function installLicense(licenseKey: string): Promise<boolean> {
  try {
    const license: License = JSON.parse(atob(licenseKey));
    
    // Validate the license before storing
    const { signature, ...licenseData } = license;
    const validation = await validateLicenseSignature(licenseData, signature);
    if (!validation) {
      throw new Error('Invalid license signature');
    }
    
    storeLicense(license);
    return true;
  } catch (error) {
    console.error('Failed to install license:', error);
    return false;
  }
}

// Get current runbook usage for the user
export async function getRunbookUsage(userId: string): Promise<RunbookUsage> {
  try {
    // Get current license
    const validation = await validateLicense();
    if (!validation.valid || !validation.license) {
      return {
        current_count: 0,
        max_allowed: 0,
        remaining: 0
      };
    }

    // Count current runbooks created by this user
    const response = await fileClient
      .from('runbooks')
      .select('*')
      .eq('created_by', userId);

    const currentCount = response.data?.length || 0;
    const maxAllowed = validation.license.max_runbooks;
    const remaining = Math.max(0, maxAllowed - currentCount);

    return {
      current_count: currentCount,
      max_allowed: maxAllowed,
      remaining: remaining
    };
  } catch (error) {
    console.error('Failed to get runbook usage:', error);
    return {
      current_count: 0,
      max_allowed: 0,
      remaining: 0
    };
  }
}

// Check if user can create a new runbook
export async function canCreateRunbook(userId: string): Promise<boolean> {
  const usage = await getRunbookUsage(userId);
  return usage.remaining > 0;
}

// Get license info for display
export async function getLicenseInfo(): Promise<{
  valid: boolean;
  customer_id?: string;
  max_runbooks?: number;
  expires_at?: number;
  features?: string[];
  error?: string;
}> {
  const validation = await validateLicense();
  
  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }

  if (validation.license) {
    return {
      valid: true,
      customer_id: validation.license.customer_id,
      max_runbooks: validation.license.max_runbooks,
      expires_at: validation.license.expires_at,
      features: validation.license.features
    };
  }

  return { valid: false, error: 'Unknown error' };
}

// Remove license (for testing/admin purposes)
export function removeLicense(): void {
  localStorage.removeItem(LICENSE_STORAGE_KEY);
} 