/**
 * Utility functions for URL handling
 */

// Server configuration
const SERVER_BASE_URL = 'http://localhost:3001';

/**
 * Convert a relative file URL to a full URL
 * @param relativeUrl - The relative URL (e.g., "/uploads/client-logos/file.jpg")
 * @returns Full URL or null if input is null/empty
 */
export const getFullFileUrl = (relativeUrl: string | null): string | null => {
  if (!relativeUrl) return null;
  if (relativeUrl.startsWith('http')) return relativeUrl; // Already a full URL
  return `${SERVER_BASE_URL}${relativeUrl}`;
};

/**
 * Convert a full URL back to a relative URL
 * @param fullUrl - The full URL (e.g., "http://localhost:3001/uploads/client-logos/file.jpg")
 * @returns Relative URL or the original URL if it's not from our server
 */
export const getRelativeFileUrl = (fullUrl: string | null): string | null => {
  if (!fullUrl) return null;
  if (fullUrl.startsWith(SERVER_BASE_URL)) {
    return fullUrl.replace(SERVER_BASE_URL, '');
  }
  return fullUrl; // Return as-is if it's not from our server
};

/**
 * Convert a client logo URL for display
 * @param logoUrl - The logo URL from the database
 * @returns Full URL for display or null
 */
export const getClientLogoUrl = (logoUrl: string | null): string | null => {
  return getFullFileUrl(logoUrl);
};

/**
 * Convert a step photo URL for display
 * @param photoUrl - The photo URL from the database
 * @returns Full URL for display or null
 */
export const getStepPhotoUrl = (photoUrl: string | null): string | null => {
  return getFullFileUrl(photoUrl);
};

/**
 * Convert a task photo URL for display
 * @param photoUrl - The photo URL from the database
 * @returns Full URL for display or null
 */
export const getTaskPhotoUrl = (photoUrl: string | null): string | null => {
  return getFullFileUrl(photoUrl);
};

/**
 * Convert an app logo URL for display
 * @param logoUrl - The logo URL from the database
 * @returns Full URL for display or null
 */
export const getAppLogoUrl = (logoUrl: string | null): string | null => {
  return getFullFileUrl(logoUrl);
};

/**
 * Convert an app branding logo URL for display
 * @param logoUrl - The logo URL from the app branding database
 * @returns Full URL for display or null
 */
export const getAppBrandingLogoUrl = (logoUrl: string | null): string | null => {
  if (!logoUrl) return null;
  
  // Handle both app-branding and general directory paths
  // Since we're now uploading to /general, but may have legacy /app-branding URLs
  if (logoUrl.startsWith('/uploads/app-branding/')) {
    // Convert app-branding path to general path
    const fileName = logoUrl.split('/').pop();
    const generalPath = `/uploads/general/${fileName}`;
    return getFullFileUrl(generalPath);
  }
  
  return getFullFileUrl(logoUrl);
}; 