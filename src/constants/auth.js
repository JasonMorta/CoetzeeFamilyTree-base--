const adminUsername = import.meta.env.VITE_ADMIN_USERNAME;
const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;

export const DEFAULT_ADMIN = {
  username: adminUsername || '',
  password: adminPassword || ''
};

export function hasConfiguredAdminCredentials() {
  return Boolean(adminUsername && adminPassword);
}
