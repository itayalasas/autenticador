import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'authsystem.mobile.profiles.v1';

export type AppProfile = {
  id: string;
  appName: string;
  baseUrl: string;
  applicationId: string;
  apiKey: string;
  email: string;
  password?: string;
  deviceToken?: string;
  deviceId: string;
  deviceName: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeText(value?: string): string {
  return (value || '').trim();
}

function profileIdentity(profile: AppProfile): string {
  return [
    normalizeText(profile.baseUrl).toLowerCase(),
    normalizeText(profile.applicationId).toLowerCase(),
    normalizeText(profile.email).toLowerCase(),
  ].join('|');
}

function dedupeProfiles(profiles: AppProfile[]): AppProfile[] {
  const byIdentity = new Map<string, AppProfile>();

  for (const profile of profiles) {
    const identity = profileIdentity(profile);
    const existing = byIdentity.get(identity);

    if (!existing) {
      byIdentity.set(identity, profile);
      continue;
    }

    const existingDate = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    const currentDate = new Date(profile.updatedAt || profile.createdAt || 0).getTime();
    if (currentDate >= existingDate) {
      byIdentity.set(identity, profile);
    }
  }

  return Array.from(byIdentity.values()).sort((a, b) => {
    const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bDate - aDate;
  });
}

export async function loadProfiles(): Promise<AppProfile[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    const deduped = dedupeProfiles(list);
    if (deduped.length !== list.length) {
      await saveProfiles(deduped);
    }
    return deduped;
  } catch {
    return [];
  }
}

export async function saveProfiles(profiles: AppProfile[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export async function upsertProfile(profile: AppProfile): Promise<AppProfile[]> {
  const current = await loadProfiles();
  const identity = profileIdentity(profile);
  const index = current.findIndex((item) => item.id === profile.id || profileIdentity(item) === identity);

  if (index >= 0) {
    current[index] = profile;
  } else {
    current.unshift(profile);
  }

  const deduped = dedupeProfiles(current);
  await saveProfiles(deduped);
  return deduped;
}

export async function removeProfile(profileId: string): Promise<AppProfile[]> {
  const current = await loadProfiles();
  const toDelete = current.find((item) => item.id === profileId);
  const targetIdentity = toDelete ? profileIdentity(toDelete) : null;
  const filtered = current.filter((item) => {
    if (item.id === profileId) return false;
    if (targetIdentity && profileIdentity(item) === targetIdentity) return false;
    return true;
  });
  await saveProfiles(filtered);
  return filtered;
}
