function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Backend contract required to enable the creator studio:
 * login responses must include data.permissions as a string array containing "ADMIN".
 * This adapter grants nothing when that contract is absent.
 */
export class AdminPermissionAdapter {
  static permissionsFromLogin(response: unknown): string[] {
    if (!isRecord(response) || !isRecord(response['data'])) {
      return [];
    }
    const permissions = response['data']['permissions'];
    if (!Array.isArray(permissions) || !permissions.includes('ADMIN')) {
      return [];
    }
    return ['admin:manage'];
  }
}
