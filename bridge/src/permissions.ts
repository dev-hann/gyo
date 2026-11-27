import { Bridge } from './Bridge';
import type { PermissionResult } from './types';

/** The handler the Android shell registers in every app. */
const PERMISSIONS_BRIDGE = 'permissions';

let permissionsBridge: Bridge | undefined;

/**
 * Asks the user for Android run-time permissions, such as
 * `android.permission.READ_CONTACTS`. Resolves once the user has answered,
 * with what is granted and what is not; a permission granted before is in
 * `granted` without a prompt. Only what the app declares in its manifest
 * can be granted: for anything else the system answers no on its own.
 *
 * Rejects outside the Android shell, where there is no such handler.
 */
export function requestPermissions(permissions: string[]): Promise<PermissionResult> {
  permissionsBridge ??= new Bridge(PERMISSIONS_BRIDGE);
  return permissionsBridge.invoke<PermissionResult>('request', { permissions });
}
