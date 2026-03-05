import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_APPROVAL_KEY = 'authsystem.mobile.biometric.approval.enabled.v1';

export async function loadBiometricApprovalEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(BIOMETRIC_APPROVAL_KEY);
  if (raw === null) {
    return true;
  }

  return raw === 'true';
}

export async function saveBiometricApprovalEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_APPROVAL_KEY, enabled ? 'true' : 'false');
}
