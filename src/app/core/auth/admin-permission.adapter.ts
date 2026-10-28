function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Backend contract required to enable the creator studio:
 * login responses must include data.token.permission with the backend's
 * PERMISSION_ADMIN value ("ADMIN"). The legacy data.permissions array is also accepted.
 * This adapter grants nothing when that contract is absent.
 */
export class AdminPermissionAdapter {
  static permissionsFromLogin(response: unknown): string[] {
    if (!isRecord(response) || !isRecord(response['data'])) {
      return [];
    }
    const data = response['data'];
    const token = isRecord(data['token']) ? data['token'] : null;
    const hasAdminPermission = token?.['permission'] === 'ADMIN'
      || (Array.isArray(data['permissions']) && data['permissions'].includes('ADMIN'));
    if (!hasAdminPermission) {
      return [];
    }
    return ['admin:manage'];
  }
}
