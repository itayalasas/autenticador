import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { listPendingChallenges, approveChallenge, generatePairingToken, registerDevice, unlinkDevice } from './src/services/api';
import { AppProfile, loadProfiles, removeProfile, upsertProfile } from './src/services/profiles';
import { loadBiometricApprovalEnabled, saveBiometricApprovalEnabled } from './src/services/settings';

const SUPABASE_URL = 'https://sfqtmnncgiqkveaoqckt.supabase.co';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type TabKey = 'authenticator' | 'verified';

function createLocalId() {
  return `profile-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function createDeviceId() {
  return `device-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function parseQrPayload(rawValue: string): {
  pairingToken?: string;
  applicationId?: string;
  appName?: string;
  apiKey?: string;
  baseUrl?: string;
  email?: string;
  password?: string;
} {
  const value = rawValue.trim();

  try {
    const json = JSON.parse(value);
    return {
      pairingToken: json.pairing_token,
      applicationId: json.application_id,
      appName: json.app_name || json.application_name,
      apiKey: json.api_key,
      baseUrl: json.base_url,
      email: json.email,
      password: json.password,
    };
  } catch {
    if (value.includes('pairing_token=') || value.includes('application_id=') || value.includes('api_key=')) {
      const queryPart = value.includes('?') ? value.split('?')[1] : value;
      const params = new URLSearchParams(queryPart);
      return {
        pairingToken: params.get('pairing_token') || undefined,
        applicationId: params.get('application_id') || undefined,
        appName: params.get('app_name') || undefined,
        apiKey: params.get('api_key') || undefined,
        baseUrl: params.get('base_url') || undefined,
        email: params.get('email') || undefined,
        password: params.get('password') || undefined,
      };
    }

    return { pairingToken: value };
  }
}

function initials(name: string) {
  if (!name) return 'A';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

function normalizeBaseUrl(baseUrl?: string) {
  return (baseUrl || SUPABASE_URL).trim().replace(/\/+$/, '');
}

export default function App() {
  const [profiles, setProfiles] = useState<AppProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [detailProfileId, setDetailProfileId] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>('authenticator');
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showAccountSettingsModal, setShowAccountSettingsModal] = useState(false);
  const [showApprovalNumberModal, setShowApprovalNumberModal] = useState(false);
  const [approvalChallenge, setApprovalChallenge] = useState<any | null>(null);
  const [approvalNumberInput, setApprovalNumberInput] = useState('');

  const [appName, setAppName] = useState('');
  const [baseUrl, setBaseUrl] = useState(SUPABASE_URL);
  const [applicationId, setApplicationId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pairingToken, setPairingToken] = useState('');
  const [deviceName, setDeviceName] = useState('Mi teléfono');
  const [deviceId, setDeviceId] = useState(createDeviceId());
  const [pushToken, setPushToken] = useState<string>('');

  const [challenges, setChallenges] = useState<any[]>([]);
  const [dynamicCodesByProfile, setDynamicCodesByProfile] = useState<Record<string, { code: string; expiresIn: number; receivedAtMs: number }>>({});
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [working, setWorking] = useState(false);
  const [workingMessage, setWorkingMessage] = useState('Procesando...');
  const [codeNowMs, setCodeNowMs] = useState(Date.now());

  const [scannerVisible, setScannerVisible] = useState(false);
  const [isScannerLocked, setIsScannerLocked] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [deviceSecurityConfigured, setDeviceSecurityConfigured] = useState(false);
  const [requireBiometricApproval, setRequireBiometricApproval] = useState(true);
  const detailCodeRefreshInFlightRef = React.useRef(false);
  const approvalCodeRefreshInFlightRef = React.useRef(false);
  const pushTokenRef = React.useRef<string>('');
  const notificationReceivedListener = React.useRef<any>(null);
  const notificationResponseListener = React.useRef<any>(null);

  useEffect(() => {
    pushTokenRef.current = pushToken;
  }, [pushToken]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCodeNowMs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const requestPushToken = async (): Promise<string> => {
    if (!Device.isDevice) {
      return '';
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return '';
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      '245ac28f-c50c-45f0-855b-a575fcd795c5';

    const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenResponse?.data || '';

    if (token) {
      setPushToken(token);
      pushTokenRef.current = token;
    }

    return token;
  };

  const waitForPushToken = async (timeoutMs = 12000): Promise<string> => {
    if (pushTokenRef.current) {
      return pushTokenRef.current;
    }

    try {
      const immediate = await requestPushToken();
      if (immediate) return immediate;
    } catch (error) {
      console.warn('⚠️ Could not get immediate push token:', error);
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (pushTokenRef.current) {
        return pushTokenRef.current;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return '';
  };

  useEffect(() => {
    const bootstrap = async () => {
      const storedProfiles = await loadProfiles();
      const biometricPreference = await loadBiometricApprovalEnabled();

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const hasEnrollment = await LocalAuthentication.isEnrolledAsync();
      const supportedMethods = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();

      setBiometricSupported(hasHardware && supportedMethods.length > 0);
      setBiometricEnrolled(hasEnrollment);
      setDeviceSecurityConfigured(enrolledLevel !== LocalAuthentication.SecurityLevel.NONE);
      setRequireBiometricApproval(biometricPreference);

      setProfiles(storedProfiles);
      if (storedProfiles.length > 0) {
        applyProfile(storedProfiles[0]);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    const registerPushNotifications = async () => {
      try {
        const token = await requestPushToken();
        if (token) {
          console.log('✅ Expo push token obtained');
        } else {
          console.log('⚠️ Push notification token not available yet');
        }
      } catch (error) {
        console.warn('⚠️ Error registering push notifications:', error);
      }
    };

    registerPushNotifications();
  }, []);

  const applyProfile = (profile: AppProfile) => {
    setActiveProfileId(profile.id);
    setAppName(profile.appName || '');
    setBaseUrl(normalizeBaseUrl(profile.baseUrl));
    setApplicationId(profile.applicationId || '');
    setApiKey(profile.apiKey || '');
    setEmail(profile.email || '');
    setPassword(profile.password || '');
    setDeviceId(profile.deviceId || createDeviceId());
    setDeviceName(profile.deviceName || 'Mi teléfono');
  };

  const persistCurrentProfile = async () => {
    if (!applicationId || !apiKey || !email) {
      Alert.alert('Faltan datos', 'Completa application_id, api_key y email para guardar la cuenta.');
      return;
    }

    const now = new Date().toISOString();
    const profile: AppProfile = {
      id: activeProfileId || createLocalId(),
      appName: appName || applicationId,
      baseUrl: normalizeBaseUrl(baseUrl),
      applicationId,
      apiKey,
      email,
      password,
      deviceId,
      deviceName,
      createdAt: now,
      updatedAt: now,
    };

    const updated = await upsertProfile(profile);
    setProfiles(updated);
    setActiveProfileId(profile.id);
    setShowSetupModal(false);
    setShowActionsModal(false);
    Alert.alert('Listo', 'Cuenta guardada en Authenticator.');
  };

  const deleteProfile = async (profile: AppProfile) => {
    const canUnlinkRemotely = !!(profile.applicationId && profile.apiKey && profile.email && profile.password && profile.deviceId);

    if (canUnlinkRemotely) {
      try {
        await unlinkDevice({
          baseUrl: normalizeBaseUrl(profile.baseUrl),
          application_id: profile.applicationId,
          api_key: profile.apiKey,
          email: profile.email,
          password: profile.password,
          device_id: profile.deviceId,
        });
      } catch (error) {
        console.warn('⚠️ No se pudo desvincular el dispositivo en servidor:', error);
      }
    }

    const updated = await removeProfile(profile.id);
    setProfiles(updated);
    setDynamicCodesByProfile((current) => {
      const next = { ...current };
      delete next[profile.id];
      return next;
    });

    if (detailProfileId === profile.id) {
      setDetailProfileId(null);
      setShowAccountSettingsModal(false);
    }

    if (activeProfileId === profile.id) {
      setActiveProfileId(null);
      if (updated.length > 0) {
        applyProfile(updated[0]);
      }
    }
  };

  const openAccountSettings = () => {
    if (!detailProfile) return;
    applyProfile(detailProfile);
    const canLoad = !!(detailProfile.applicationId && detailProfile.apiKey && detailProfile.email && detailProfile.password);
    if (canLoad) {
      onLoadChallenges(detailProfile);
    }
    setShowAccountSettingsModal(true);
  };

  const onRenameAccount = () => {
    if (!detailProfile) return;
    setShowAccountSettingsModal(false);
    setShowSetupModal(true);
    Alert.alert('Editar cuenta', 'Puedes cambiar el nombre de la cuenta en el campo "Nombre de la aplicación" y guardar.');
  };

  const onAddAccountToDevice = () => {
    setShowAccountSettingsModal(false);
    setShowActionsModal(true);
  };

  const onRemoveCurrentAccount = () => {
    if (!detailProfile) return;
    Alert.alert(
      'Quitar cuenta',
      `¿Seguro que deseas quitar ${detailProfile.appName || detailProfile.applicationId}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            await deleteProfile(detailProfile);
            Alert.alert('Cuenta eliminada', 'La cuenta fue eliminada del dispositivo.');
          },
        },
      ]
    );
  };

  const onOpenPasswordChange = () => {
    if (!detailProfile) return;
    Alert.alert('Cambiar contraseña', `Realiza este cambio en el portal de ${detailProfile.appName || detailProfile.applicationId}.`);
  };

  const onOpenSecurityInfo = () => {
    if (!detailProfile) return;
    setShowSetupModal(true);
    Alert.alert('Información de seguridad', 'Desde Configurar cuenta puedes actualizar credenciales y datos de vinculación.');
  };

  const onOpenRecentActivity = async () => {
    if (!detailProfile) return;
    await onLoadChallenges(detailProfile);
    Alert.alert('Actividad reciente', 'Se recargaron las solicitudes pendientes de esta cuenta.');
  };

  const onOpenPasskey = () => {
    Alert.alert('Clave de paso', 'Función preparada. Puedes implementarla en tu backend para registrar passkeys.');
  };

  const onOpenPasswordlessConfig = () => {
    setShowActionsModal(true);
    Alert.alert('Solicitudes sin contraseña', 'Desde el menú puedes activar/desactivar biometría para aprobar solicitudes.');
  };

  const onOpenNotificationsConfig = async () => {
    if (!detailProfile) return;

    const latestChallenges = await loadChallengesForProfile(detailProfile, { silent: true });
    setChallenges(latestChallenges);

    const pendingForProfile = latestChallenges.filter((challenge: any) => {
      const challengeEmail = challenge?.metadata?.email;
      const challengeApp = challenge?.metadata?.application_id;
      return challengeEmail === detailProfile.email && challengeApp === detailProfile.applicationId;
    });

    if (!pendingForProfile.length) {
      Alert.alert('Notificaciones', 'No hay solicitudes pendientes.');
      return;
    }

    beginApproveChallenge(pendingForProfile[0], detailProfile.id);
  };

  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Debes habilitar la cámara para escanear QR.');
        return;
      }
    }

    setShowActionsModal(false);
    setIsScannerLocked(false);
    setScannerVisible(true);
  };

  const saveLinkedProfile = async (input: {
    applicationId?: string;
    appName?: string;
    email?: string;
    password?: string;
    apiKey?: string;
    baseUrl?: string;
  }) => {
    const resolvedApplicationId = input.applicationId || applicationId || '';
    const resolvedAppName = input.appName || appName || resolvedApplicationId || 'Authenticator';
    const resolvedEmail = input.email || email || '';
    const resolvedPassword = input.password || password || '';
    const resolvedBaseUrl = normalizeBaseUrl(input.baseUrl || baseUrl || SUPABASE_URL);

    const existingProfile = profiles.find((item) => item.applicationId === resolvedApplicationId && item.email === resolvedEmail);
    const now = new Date().toISOString();

    const profile: AppProfile = {
      id: existingProfile?.id || createLocalId(),
      appName: resolvedAppName,
      baseUrl: resolvedBaseUrl,
      applicationId: resolvedApplicationId,
      apiKey: input.apiKey || existingProfile?.apiKey || apiKey || '',
      email: resolvedEmail,
      password: resolvedPassword || existingProfile?.password || '',
      deviceId,
      deviceName,
      createdAt: existingProfile?.createdAt || now,
      updatedAt: now,
    };

    const updatedProfiles = await upsertProfile(profile);
    setProfiles(updatedProfiles);
    applyProfile(profile);
    setTab('authenticator');
    setShowSetupModal(false);
    setShowActionsModal(false);

    return profile;
  };

  const onQrScanned = async (rawData: string) => {
    if (isScannerLocked) return;
    setIsScannerLocked(true);

    const parsed = parseQrPayload(rawData);

    if (parsed.pairingToken) setPairingToken(parsed.pairingToken);
    if (parsed.applicationId) setApplicationId(parsed.applicationId);
    if (parsed.appName) setAppName(parsed.appName);
    if (parsed.apiKey) setApiKey(parsed.apiKey);
    if (parsed.baseUrl) setBaseUrl(parsed.baseUrl);
    if (parsed.email) setEmail(parsed.email);
    if (parsed.password) setPassword(parsed.password);

    setScannerVisible(false);

    if (parsed.pairingToken) {
      setWorkingMessage('Preparando registro automático...');
      setWorking(true);
      try {
        const resolvedBaseUrl = normalizeBaseUrl(parsed.baseUrl || baseUrl || SUPABASE_URL);
        const resolvedPushToken = await waitForPushToken();

        setWorkingMessage('Registrando dispositivo en AuthSystem...');
        const result = await registerDevice({
          baseUrl: resolvedBaseUrl,
          pairing_token: parsed.pairingToken,
          device_id: deviceId,
          device_name: deviceName,
          push_token: resolvedPushToken || undefined,
          push_provider: resolvedPushToken ? 'expo' : undefined,
          device_platform: Device.osName || undefined,
        });

        if (!result.success) throw new Error(result.error?.message || 'No se pudo registrar dispositivo');

        const linkedProfile = await saveLinkedProfile({
          applicationId: result.data?.application?.application_id || parsed.applicationId,
          appName: result.data?.application?.name || parsed.appName,
          email: result.data?.user?.email || parsed.email,
          password: parsed.password,
          apiKey: result.data?.application?.api_key || parsed.apiKey,
          baseUrl: resolvedBaseUrl,
        });

        setWorkingMessage('Sincronizando solicitudes MFA...');
        if (linkedProfile) {
          await onLoadChallenges(linkedProfile);
          setDetailProfileId(linkedProfile.id);
        }
      } catch (error: any) {
        if (parsed.pairingToken) setPairingToken(parsed.pairingToken);
        setShowSetupModal(true);
        Alert.alert('Vinculación manual', error.message || 'No se pudo vincular automáticamente. Completa el registro manual.');
      } finally {
        setWorking(false);
      }
      return;
    }

    if (parsed.applicationId && parsed.apiKey) {
      setWorkingMessage('Guardando cuenta automáticamente...');
      setWorking(true);
      try {
        const autoProfile = await saveLinkedProfile({
          applicationId: parsed.applicationId,
          appName: parsed.appName,
          email: parsed.email,
          password: parsed.password,
          apiKey: parsed.apiKey,
          baseUrl: parsed.baseUrl,
        });

        if (autoProfile) {
          setWorkingMessage('Sincronizando solicitudes MFA...');
          await onLoadChallenges(autoProfile);
          setDetailProfileId(autoProfile.id);
        }
      } catch (error: any) {
        setShowSetupModal(true);
        Alert.alert('QR leído', error?.message || 'Datos detectados. Completa y guarda manualmente la cuenta.');
      } finally {
        setWorking(false);
      }
      return;
    }

    Alert.alert('QR leído', 'No se detectaron datos compatibles.');
  };

  const credentials = useMemo(
    () => ({
      baseUrl: normalizeBaseUrl(baseUrl),
      application_id: applicationId,
      api_key: apiKey,
      email,
      password,
    }),
    [baseUrl, applicationId, apiKey, email, password]
  );

  const loadChallengesForProfile = useCallback(async (profile: AppProfile, options?: { silent?: boolean }) => {
    const hasChallengeCredentials = !!(profile.applicationId && profile.apiKey && profile.email && profile.password);
    if (!hasChallengeCredentials) {
      return [];
    }

    try {
      const result = await listPendingChallenges({
        baseUrl: normalizeBaseUrl(profile.baseUrl),
        application_id: profile.applicationId,
        api_key: profile.apiKey,
        email: profile.email,
        password: profile.password,
        device_id: profile.deviceId || deviceId,
        device_name: profile.deviceName || deviceName,
        push_token: pushToken || undefined,
        push_provider: pushToken ? 'expo' : undefined,
        device_platform: Device.osName || undefined,
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'No se pudieron cargar solicitudes');
      }

      const receivedAtMs = Date.now();
      const currentDynamicCode = String(result.data?.current_challenge_code || '');
      const currentDynamicCodeExpiresIn = Number(result.data?.current_challenge_code_expires_in_seconds || 0);

      setDynamicCodesByProfile((current) => ({
        ...current,
        [profile.id]: {
          code: currentDynamicCode,
          expiresIn: currentDynamicCodeExpiresIn,
          receivedAtMs,
        },
      }));

      const normalizedChallenges = (result.data?.challenges || []).map((challenge: any) => ({
        ...challenge,
        _receivedAtMs: receivedAtMs,
        challenge_code_expires_in_seconds: Number(challenge?.challenge_code_expires_in_seconds || 0),
      }));

      return normalizedChallenges;
    } catch (error: any) {
      if (!options?.silent) {
        Alert.alert('Error', error.message || 'Error cargando solicitudes');
      }
      return [];
    }
  }, [pushToken, deviceId, deviceName]);

  const onLoadChallenges = async (targetProfile?: AppProfile) => {
    const profile = targetProfile || profiles.find((item) => item.id === activeProfileId) || null;
    if (!profile) {
      Alert.alert('Sin cuenta', 'Selecciona o crea una cuenta primero.');
      return;
    }

    const hasChallengeCredentials = !!(profile.applicationId && profile.apiKey && profile.email && profile.password);
    if (!hasChallengeCredentials) {
      setChallenges([]);
      return;
    }

    if (!targetProfile) {
      setBaseUrl(normalizeBaseUrl(profile.baseUrl));
      setApplicationId(profile.applicationId || '');
      setApiKey(profile.apiKey || '');
      setEmail(profile.email || '');
      setPassword(profile.password || '');
    }

    setLoadingChallenges(true);
    try {
      const latestChallenges = await loadChallengesForProfile(profile);
      setChallenges(latestChallenges);
    } finally {
      setLoadingChallenges(false);
    }
  };

  const openApprovalModalFromNotification = async (payload: any, openDetail: boolean) => {
    if (payload?.type !== 'mfa_challenge') return;

    const matchingProfile = profiles.find(
      (profile) => profile.applicationId === payload.application_id && profile.email === payload.user_email
    );

    if (!matchingProfile) return;

    setActiveProfileId(matchingProfile.id);
    if (openDetail) {
      setDetailProfileId(matchingProfile.id);
    }

    const latestChallenges = await loadChallengesForProfile(matchingProfile, { silent: true });
    setChallenges(latestChallenges);

    const selectedChallenge = latestChallenges.find((item: any) => item.id === payload.challenge_id) || latestChallenges[0] || {
      id: payload.challenge_id,
      challenge_code: payload.challenge_code,
      challenge_code_expires_in_seconds: 60,
      _receivedAtMs: Date.now(),
      metadata: {
        verification_number: payload.verification_number,
        email: payload.user_email,
        application_id: payload.application_id,
      },
      status: 'pending',
    };

    const verificationNumber = String(selectedChallenge?.metadata?.verification_number || payload.verification_number || '').padStart(2, '0');
    if (!verificationNumber) return;

    setApprovalChallenge(selectedChallenge);
    setApprovalNumberInput('');
    setShowApprovalNumberModal(true);
  };

  useEffect(() => {
    notificationReceivedListener.current = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data as any;
      await openApprovalModalFromNotification(data, false);
    });

    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data as any;
      await openApprovalModalFromNotification(data, true);
    });

    return () => {
      if (notificationReceivedListener.current) {
        Notifications.removeNotificationSubscription(notificationReceivedListener.current);
      }

      if (notificationResponseListener.current) {
        Notifications.removeNotificationSubscription(notificationResponseListener.current);
      }
    };
  }, [profiles, pushToken, deviceId, deviceName]);

  useEffect(() => {
    const checkInitialNotification = async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      const data = response?.notification?.request?.content?.data as any;
      if (!data) return;
      await openApprovalModalFromNotification(data, true);
    };

    checkInitialNotification();
  }, [profiles, pushToken, deviceId, deviceName]);

  useEffect(() => {
    let isCancelled = false;

    const syncActiveProfileChallenges = async () => {
      const profile = profiles.find((item) => item.id === activeProfileId);
      if (!profile) return;

      const latestChallenges = await loadChallengesForProfile(profile, { silent: true });
      if (!isCancelled) {
        setChallenges(latestChallenges);
      }
    };

    syncActiveProfileChallenges();
    const timer = setInterval(syncActiveProfileChallenges, 5000);

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [activeProfileId, profiles, pushToken, deviceId, deviceName, loadChallengesForProfile]);

  const toggleBiometricRequirement = async () => {
    if (!requireBiometricApproval) {
      if (!deviceSecurityConfigured) {
        Alert.alert(
          'Seguridad no configurada',
          'Este dispositivo no tiene biometría ni PIN/contraseña. Configura al menos un método de seguridad para continuar.'
        );
        return;
      }
    }

    const nextValue = !requireBiometricApproval;
    setRequireBiometricApproval(nextValue);
    await saveBiometricApprovalEnabled(nextValue);
  };

  const verifyBiometricForApproval = async (): Promise<boolean> => {
    if (!requireBiometricApproval) return true;

    const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();
    const hasDeviceSecurity = enrolledLevel !== LocalAuthentication.SecurityLevel.NONE;
    setDeviceSecurityConfigured(hasDeviceSecurity);

    if (!hasDeviceSecurity) {
      Alert.alert(
        'Seguridad no configurada',
        'Este dispositivo no tiene biometría ni PIN/contraseña. Configura al menos un método de seguridad para aprobar solicitudes.'
      );
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: biometricSupported && biometricEnrolled
        ? 'Confirma aprobación MFA'
        : 'Confirma con PIN o contraseña para aprobar MFA',
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar PIN o contraseña',
      disableDeviceFallback: false,
    });

    if (!result.success) {
      const errorCode = 'error' in result ? result.error : undefined;
      if (errorCode === 'passcode_not_set') {
        Alert.alert(
          'Seguridad no configurada',
          'Configura biometría o PIN/contraseña en el dispositivo para poder aprobar solicitudes.'
        );
      } else if (errorCode === 'not_available' || errorCode === 'not_enrolled') {
        const refreshedLevel = await LocalAuthentication.getEnrolledLevelAsync();
        const stillHasDeviceSecurity = refreshedLevel !== LocalAuthentication.SecurityLevel.NONE;
        setDeviceSecurityConfigured(stillHasDeviceSecurity);

        if (stillHasDeviceSecurity) {
          return true;
        }

        Alert.alert(
          'Seguridad no configurada',
          'Configura biometría o PIN/contraseña en el dispositivo para poder aprobar solicitudes.'
        );
      } else if (errorCode !== 'user_cancel') {
        Alert.alert('Verificación fallida', 'No fue posible confirmar la seguridad del dispositivo.');
      }
      return false;
    }

    return true;
  };

  const onResolveChallenge = async (challenge: any, action: 'approve' | 'reject', verificationNumber?: string) => {
    const profile = profiles.find((item) => item.id === activeProfileId);
    if (!profile) {
      Alert.alert('Sin cuenta', 'Selecciona una cuenta para responder la solicitud.');
      return;
    }

    if (action === 'approve') {
      const allowed = await verifyBiometricForApproval();
      if (!allowed) return;
    }

    setWorking(true);
    try {
      const result = await approveChallenge({
        baseUrl: normalizeBaseUrl(profile.baseUrl),
        application_id: profile.applicationId,
        api_key: profile.apiKey,
        email: profile.email,
        password: profile.password,
        challenge_id: challenge.id,
        challenge_code: challenge.challenge_code,
        verification_number: verificationNumber,
        action,
      });
      if (!result.success) throw new Error(result.error?.message || 'No se pudo procesar solicitud');
      await onLoadChallenges(profile);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error procesando solicitud');
    } finally {
      setWorking(false);
    }
  };

  const beginApproveChallenge = (challenge: any, profileId: string) => {
    const verificationNumber = String(challenge?.metadata?.verification_number || '').padStart(2, '0');
    setActiveProfileId(profileId);

    if (verificationNumber) {
      setApprovalChallenge(challenge);
      setApprovalNumberInput('');
      setShowApprovalNumberModal(true);
      return;
    }

    onResolveChallenge(challenge, 'approve');
  };

  const confirmApproveWithNumber = async () => {
    if (!approvalChallenge) return;

    const expectedNumber = String(approvalChallenge?.metadata?.verification_number || '').padStart(2, '0');
    const entered = approvalNumberInput.trim().padStart(2, '0');

    if (!entered || entered.length !== 2) {
      Alert.alert('Número requerido', 'Ingresa el número de dos dígitos que se muestra en el login web.');
      return;
    }

    if (expectedNumber && entered !== expectedNumber) {
      Alert.alert('Número incorrecto', 'El número ingresado no coincide con el mostrado en el login.');
      return;
    }

    let challengeToApprove = approvalChallenge;
    const profile = profiles.find((item) => item.id === activeProfileId);

    if (profile) {
      const latestChallenges = await loadChallengesForProfile(profile, { silent: true });
      setChallenges(latestChallenges);
      const refreshedChallenge = latestChallenges.find((item: any) => item.id === approvalChallenge.id);
      if (refreshedChallenge) {
        challengeToApprove = refreshedChallenge;
      }
    }

    setShowApprovalNumberModal(false);
    setApprovalChallenge(null);
    setApprovalNumberInput('');
    await onResolveChallenge(challengeToApprove, 'approve', entered);
  };

  const onGeneratePairing = async () => {
    const profile = profiles.find((item) => item.id === activeProfileId);
    if (!profile) {
      Alert.alert('Sin cuenta', 'Primero guarda una cuenta para generar pairing.');
      return;
    }

    setWorking(true);
    try {
      const result = await generatePairingToken({
        baseUrl: normalizeBaseUrl(profile.baseUrl),
        application_id: profile.applicationId,
        api_key: profile.apiKey,
        email: profile.email,
        password: profile.password,
      });
      if (!result.success) throw new Error(result.error?.message || 'No se pudo generar token');
      setPairingToken(result.data?.pairing_token || '');
      Alert.alert('Token MFA generado', 'Ya puedes registrar el dispositivo.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error generando pairing');
    } finally {
      setWorking(false);
    }
  };

  const onRegisterDevice = async () => {
    setWorking(true);
    try {
      setWorkingMessage('Preparando notificaciones del dispositivo...');
      const resolvedPushToken = await waitForPushToken();

      setWorkingMessage('Registrando dispositivo...');
      const result = await registerDevice({
        baseUrl: normalizeBaseUrl(baseUrl),
        pairing_token: pairingToken,
        device_id: deviceId,
        device_name: deviceName,
        push_token: resolvedPushToken || undefined,
        push_provider: resolvedPushToken ? 'expo' : undefined,
        device_platform: Device.osName || undefined,
      });
      if (!result.success) throw new Error(result.error?.message || 'No se pudo registrar dispositivo');

      const linkedProfile = await saveLinkedProfile({
        applicationId: result.data?.application?.application_id || applicationId,
        appName: result.data?.application?.name || appName,
        email: result.data?.user?.email || email,
        apiKey: result.data?.application?.api_key || apiKey,
        baseUrl,
      });

      setWorkingMessage('Sincronizando solicitudes MFA...');
      if (linkedProfile) {
        await onLoadChallenges(linkedProfile);
        setDetailProfileId(linkedProfile.id);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error registrando dispositivo');
    } finally {
      setWorking(false);
    }
  };

  const pendingByProfile = useMemo(() => {
    const map: Record<string, any[]> = {};
    profiles.forEach((profile) => {
      map[profile.id] = challenges.filter((challenge) => {
        const challengeEmail = challenge?.metadata?.email;
        const challengeApp = challenge?.metadata?.application_id;
        return challengeEmail === profile.email && challengeApp === profile.applicationId;
      });
    });
    return map;
  }, [profiles, challenges]);

  const detailProfile = useMemo(
    () => profiles.find((profile) => profile.id === detailProfileId) || null,
    [profiles, detailProfileId]
  );

  const detailChallenges = detailProfile ? pendingByProfile[detailProfile.id] || [] : [];
  const detailChallenge = detailChallenges[0] || null;
  const detailDynamicCode = detailProfile ? dynamicCodesByProfile[detailProfile.id] : undefined;
  const detailCode = detailChallenge?.challenge_code || detailDynamicCode?.code || '--- ---';
  const detailCodeHasValue = detailCode !== '--- ---';
  const detailCodeExpiresIn = useMemo(() => {
    if (!detailChallenge && !detailDynamicCode) return 0;

    const baseSeconds = detailChallenge
      ? Number(detailChallenge?.challenge_code_expires_in_seconds || 0)
      : Number(detailDynamicCode?.expiresIn || 0);
    const receivedAtMs = detailChallenge
      ? Number(detailChallenge?._receivedAtMs || 0)
      : Number(detailDynamicCode?.receivedAtMs || 0);

    if (!baseSeconds || !receivedAtMs) return 0;

    const elapsedSeconds = Math.floor((codeNowMs - receivedAtMs) / 1000);
    return Math.max(0, baseSeconds - elapsedSeconds);
  }, [detailChallenge, detailDynamicCode, codeNowMs]);

  const approvalCodeExpiresIn = useMemo(() => {
    if (!approvalChallenge) return 0;

    const baseSeconds = Number(approvalChallenge?.challenge_code_expires_in_seconds || 0);
    const receivedAtMs = Number(approvalChallenge?._receivedAtMs || 0);

    if (!baseSeconds || !receivedAtMs) return 0;

    const elapsedSeconds = Math.floor((codeNowMs - receivedAtMs) / 1000);
    return Math.max(0, baseSeconds - elapsedSeconds);
  }, [approvalChallenge, codeNowMs]);

  useEffect(() => {
    if (!detailProfile || (!detailChallenge && !detailDynamicCode)) {
      detailCodeRefreshInFlightRef.current = false;
      return;
    }

    if (detailCodeExpiresIn > 0 || detailCodeRefreshInFlightRef.current) {
      return;
    }

    detailCodeRefreshInFlightRef.current = true;

    const refreshChallengeCode = async () => {
      const latestChallenges = await loadChallengesForProfile(detailProfile, { silent: true });
      setChallenges(latestChallenges);

      if (showApprovalNumberModal && approvalChallenge?.id) {
        const refreshedChallenge = latestChallenges.find((item: any) => item.id === approvalChallenge.id);
        if (refreshedChallenge) {
          setApprovalChallenge(refreshedChallenge);
        }
      }
    };

    refreshChallengeCode().finally(() => {
      detailCodeRefreshInFlightRef.current = false;
    });
  }, [detailCodeExpiresIn, detailProfile, detailChallenge, detailDynamicCode, showApprovalNumberModal, approvalChallenge, loadChallengesForProfile]);

  useEffect(() => {
    if (!showApprovalNumberModal || !approvalChallenge?.id) {
      approvalCodeRefreshInFlightRef.current = false;
      return;
    }

    if (approvalCodeExpiresIn > 0 || approvalCodeRefreshInFlightRef.current) {
      return;
    }

    const profile = profiles.find((item) => item.id === activeProfileId);
    if (!profile) {
      return;
    }

    approvalCodeRefreshInFlightRef.current = true;

    const refreshApprovalChallenge = async () => {
      const latestChallenges = await loadChallengesForProfile(profile, { silent: true });
      setChallenges(latestChallenges);

      const refreshedChallenge = latestChallenges.find((item: any) => item.id === approvalChallenge.id);
      if (refreshedChallenge) {
        setApprovalChallenge(refreshedChallenge);
      }
    };

    refreshApprovalChallenge().finally(() => {
      approvalCodeRefreshInFlightRef.current = false;
    });
  }, [showApprovalNumberModal, approvalChallenge, approvalCodeExpiresIn, profiles, activeProfileId, loadChallengesForProfile]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton}>
          <Text style={styles.headerIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Authenticator</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton} onPress={() => onLoadChallenges()}>
            {loadingChallenges ? <ActivityIndicator color="#fff" /> : <Text style={styles.headerIcon}>⌕</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              setShowActionsModal(true);
            }}
          >
            <Text style={styles.headerIcon}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.listContainer} contentContainerStyle={{ paddingBottom: 140 }}>
        {tab === 'authenticator' ? (
          detailProfile ? (
            <View style={styles.detailScreen}>
              <View style={styles.detailTopCard}>
                <View style={styles.detailTopBar}>
                  <TouchableOpacity style={styles.detailIconButton} onPress={() => setDetailProfileId(null)}>
                    <Text style={styles.detailHeaderIcon}>‹</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.detailIconButton} onPress={openAccountSettings}>
                    <Text style={styles.detailHeaderIcon}>⚙</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detailIdentityRow}>
                  <View style={styles.detailAvatar}>
                    <Text style={styles.detailAvatarText}>{initials(detailProfile.appName || detailProfile.applicationId)}</Text>
                  </View>
                  <View style={styles.detailIdentityText}>
                    <Text style={styles.detailAppName}>{detailProfile.appName || detailProfile.applicationId}</Text>
                    <Text style={styles.detailEmail}>{detailProfile.email}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.detailSectionHeaderWrap}>
                <Text style={styles.detailSectionHeader}>FORMAS DE INICIAR SESIÓN O COMPROBAR</Text>
              </View>

              <TouchableOpacity style={styles.detailRow} onPress={onOpenNotificationsConfig}>
                <View style={styles.detailRowIconWrap}>
                  <Text style={styles.detailRowIcon}>✓</Text>
                </View>
                <View style={styles.detailRowTextWrap}>
                  <Text style={styles.detailRowTitle}>Notificaciones de inicio de sesión</Text>
                  <Text style={styles.detailRowSubtitle}>Aprobar una solicitud de inicio de sesión en el teléfono</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.detailCodeRow}>
                <View style={styles.detailCodeBadge}>
                  <Text style={styles.detailCodeBadgeText}>{detailCodeHasValue ? `${detailCodeExpiresIn}s` : '--'}</Text>
                </View>
                <View style={styles.detailCodeTextWrap}>
                  <Text style={styles.detailCodeTitle}>Código de contraseña de un solo uso</Text>
                  <Text style={styles.detailCodeValue}>{detailCode}</Text>
                </View>
                <TouchableOpacity
                  style={styles.detailCopyButton}
                  onPress={() => {
                    Alert.alert('Código', detailCode === '--- ---' ? 'No hay código disponible ahora.' : `Código actual: ${detailCode}`);
                  }}
                >
                  <Text style={styles.detailCopyIcon}>⧉</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.detailSectionHeaderWrap}>
                <Text style={styles.detailSectionHeader}>OTRAS FORMAS DE INICIAR SESIÓN</Text>
              </View>

              <TouchableOpacity style={styles.detailSimpleAction} onPress={onOpenPasskey}>
                <Text style={styles.detailSimpleActionText}>Crear una clave de paso</Text>
                <Text style={styles.detailSimpleActionChevron}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.detailSimpleAction} onPress={onOpenPasswordlessConfig}>
                <Text style={styles.detailSimpleActionText}>Configuración de solicitudes de inicio de sesión sin contraseña</Text>
                <Text style={styles.detailSimpleActionChevron}>›</Text>
              </TouchableOpacity>

              <View style={styles.detailSectionHeaderWrap}>
                <Text style={styles.detailSectionHeader}>ADMINISTRAR</Text>
              </View>

              <TouchableOpacity style={styles.detailSimpleAction} onPress={onOpenPasswordChange}>
                <Text style={styles.detailSimpleActionText}>Cambiar contraseña</Text>
                <Text style={styles.detailSimpleActionChevron}>↗</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.detailSimpleAction} onPress={onOpenSecurityInfo}>
                <Text style={styles.detailSimpleActionText}>Actualizar la información de seguridad</Text>
                <Text style={styles.detailSimpleActionChevron}>↗</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.detailSimpleAction} onPress={onOpenRecentActivity}>
                <Text style={styles.detailSimpleActionText}>Revisar la actividad reciente</Text>
                <Text style={styles.detailSimpleActionChevron}>↗</Text>
              </TouchableOpacity>

              {detailChallenge && (
                <View style={styles.detailActionButtons}>
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => {
                      beginApproveChallenge(detailChallenge, detailProfile.id);
                    }}
                    disabled={working}
                  >
                    <Text style={styles.approveText}>Aprobar solicitud actual</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => {
                      setActiveProfileId(detailProfile.id);
                      onResolveChallenge(detailChallenge, 'reject');
                    }}
                    disabled={working}
                  >
                    <Text style={styles.rejectText}>Rechazar solicitud actual</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <>
              {profiles.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>No tienes cuentas todavía</Text>
                  <Text style={styles.emptySubtitle}>Pulsa + para escanear QR o agregar una cuenta manualmente.</Text>
                </View>
              ) : (
                profiles.map((profile) => {
                  const isActive = activeProfileId === profile.id;
                  const profileChallenges = pendingByProfile[profile.id] || [];
                  const highlightedChallenge = profileChallenges[0];
                  const profileDynamicCode = dynamicCodesByProfile[profile.id];
                  const profileCodeValue = highlightedChallenge?.challenge_code || profileDynamicCode?.code || '--- ---';
                  const profileCodeHasValue = profileCodeValue !== '--- ---';
                  const profileCodeBaseSeconds = highlightedChallenge
                    ? Number(highlightedChallenge?.challenge_code_expires_in_seconds || 0)
                    : Number(profileDynamicCode?.expiresIn || 0);
                  const profileCodeReceivedAtMs = highlightedChallenge
                    ? Number(highlightedChallenge?._receivedAtMs || 0)
                    : Number(profileDynamicCode?.receivedAtMs || 0);
                  const profileCodeElapsedSeconds = profileCodeReceivedAtMs
                    ? Math.floor((codeNowMs - profileCodeReceivedAtMs) / 1000)
                    : 0;
                  const profileCodeExpiresIn = (profileCodeBaseSeconds && profileCodeReceivedAtMs)
                    ? Math.max(0, profileCodeBaseSeconds - profileCodeElapsedSeconds)
                    : 0;

                  return (
                    <View key={profile.id} style={styles.rowSection}>
                      <TouchableOpacity
                        style={[styles.accountRow, isActive ? styles.accountRowActive : undefined]}
                        onPress={() => {
                          applyProfile(profile);
                          setDetailProfileId(profile.id);
                          const canLoad = !!(profile.applicationId && profile.apiKey && profile.email && profile.password);
                          if (canLoad) {
                            onLoadChallenges(profile);
                          }
                        }}
                        onLongPress={() => deleteProfile(profile)}
                      >
                        <View style={styles.avatarCircle}>
                          <Text style={styles.avatarText}>{initials(profile.appName || profile.applicationId)}</Text>
                        </View>

                        <View style={styles.accountInfo}>
                          <Text style={styles.accountName}>{profile.appName || profile.applicationId}</Text>
                          <Text style={styles.accountMeta}>{profile.email}</Text>
                        </View>

                        <Text style={styles.chevron}>›</Text>
                      </TouchableOpacity>

                      {highlightedChallenge && (
                        <View style={styles.codeBlock}>
                          <Text style={styles.codeText}>{profileCodeValue}</Text>
                          <View style={styles.codeBadge}>
                            <Text style={styles.codeBadgeText}>{profileCodeHasValue ? `${profileCodeExpiresIn}s` : '--'}</Text>
                          </View>
                          <View style={styles.codeActions}>
                            <TouchableOpacity
                              style={styles.approveButton}
                              onPress={() => {
                                beginApproveChallenge(highlightedChallenge, profile.id);
                              }}
                              disabled={working}
                            >
                              <Text style={styles.approveText}>Aprobar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.rejectButton}
                              onPress={() => {
                                setActiveProfileId(profile.id);
                                onResolveChallenge(highlightedChallenge, 'reject');
                              }}
                              disabled={working}
                            >
                              <Text style={styles.rejectText}>Rechazar</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Id. comprobados</Text>
            <Text style={styles.emptySubtitle}>Sección reservada para futuras verificaciones.</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowActionsModal(true)}>
        <Text style={styles.fabText}>⌁</Text>
      </TouchableOpacity>

      <View style={styles.bottomTabs}>
        <TouchableOpacity style={styles.tabButton} onPress={() => setTab('authenticator')}>
          <Text style={[styles.tabIcon, tab === 'authenticator' && styles.tabIconActive]}>⌂</Text>
          <Text style={[styles.tabLabel, tab === 'authenticator' && styles.tabLabelActive]}>Authenticator</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabButton} onPress={() => setTab('verified')}>
          <Text style={[styles.tabIcon, tab === 'verified' && styles.tabIconActive]}>🪪</Text>
          <Text style={[styles.tabLabel, tab === 'verified' && styles.tabLabelActive]}>Id. comprobados</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showActionsModal} transparent animationType="fade" onRequestClose={() => setShowActionsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Agregar o gestionar</Text>

            <TouchableOpacity style={styles.sheetAction} onPress={openScanner}>
              <Text style={styles.sheetActionText}>Escanear código QR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetAction}
              onPress={() => {
                setShowActionsModal(false);
                setShowSetupModal(true);
              }}
            >
              <Text style={styles.sheetActionText}>Agregar cuenta manual</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetAction}
              onPress={toggleBiometricRequirement}
            >
              <Text style={styles.sheetActionText}>
                Biometría: {requireBiometricApproval ? 'Activa' : 'Inactiva'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetCancel} onPress={() => setShowActionsModal(false)}>
              <Text style={styles.sheetCancelText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSetupModal} animationType="slide" onRequestClose={() => setShowSetupModal(false)}>
        <SafeAreaView style={styles.setupSafe}>
          <View style={styles.setupHeader}>
            <Text style={styles.setupTitle}>Configurar cuenta</Text>
            <TouchableOpacity onPress={() => setShowSetupModal(false)}>
              <Text style={styles.setupClose}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.setupContent}>
            <TextInput style={styles.input} placeholder="Nombre de la aplicación" placeholderTextColor="#8CA0BC" value={appName} onChangeText={setAppName} />
            <TextInput style={styles.input} placeholder="base_url" placeholderTextColor="#8CA0BC" value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="application_id" placeholderTextColor="#8CA0BC" value={applicationId} onChangeText={setApplicationId} />
            <TextInput style={styles.input} placeholder="api_key" placeholderTextColor="#8CA0BC" value={apiKey} onChangeText={setApiKey} />
            <TextInput style={styles.input} placeholder="email" placeholderTextColor="#8CA0BC" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="password" placeholderTextColor="#8CA0BC" value={password} onChangeText={setPassword} secureTextEntry />

            <TouchableOpacity style={styles.saveButton} onPress={persistCurrentProfile}>
              <Text style={styles.saveButtonText}>Guardar cuenta</Text>
            </TouchableOpacity>

            <View style={styles.divider} />
            <Text style={styles.setupSection}>Vinculación MFA</Text>
            <TextInput style={styles.input} placeholder="pairing_token" placeholderTextColor="#8CA0BC" value={pairingToken} onChangeText={setPairingToken} />
            <TextInput style={styles.input} placeholder="device_id" placeholderTextColor="#8CA0BC" value={deviceId} onChangeText={setDeviceId} />
            <TextInput style={styles.input} placeholder="device_name" placeholderTextColor="#8CA0BC" value={deviceName} onChangeText={setDeviceName} />

            <TouchableOpacity style={styles.secondaryAction} onPress={onGeneratePairing} disabled={working}>
              <Text style={styles.secondaryActionText}>Generar pairing token</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryAction} onPress={onRegisterDevice} disabled={working}>
              <Text style={styles.primaryActionText}>Registrar dispositivo</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showAccountSettingsModal} animationType="slide" onRequestClose={() => setShowAccountSettingsModal(false)}>
        <SafeAreaView style={styles.accountSettingsSafe}>
          <View style={styles.accountSettingsHeader}>
            <TouchableOpacity style={styles.accountSettingsBackButton} onPress={() => setShowAccountSettingsModal(false)}>
              <Text style={styles.accountSettingsBackText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.accountSettingsTitle}>Configuración de cuenta</Text>
            <View style={styles.accountSettingsHeaderSpacer} />
          </View>

          <ScrollView style={styles.accountSettingsContent}>
            <TouchableOpacity style={styles.accountSettingsRow} onPress={onRenameAccount}>
              <Text style={styles.accountSettingsRowLabel}>Nombre de cuenta</Text>
              <View style={styles.accountSettingsValueWrap}>
                <Text style={styles.accountSettingsRowValue}>{detailProfile?.appName || detailProfile?.applicationId || '-'}</Text>
                <Text style={styles.accountSettingsChevron}>›</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.accountSettingsRow} onPress={onAddAccountToDevice}>
              <Text style={styles.accountSettingsRowLabel}>Agregar una cuenta a este dispositivo</Text>
              <Text style={styles.accountSettingsChevron}>›</Text>
            </TouchableOpacity>

            <Text style={styles.accountSettingsHelp}>
              Mantenga la sesión iniciada en las aplicaciones compatibles del dispositivo en las que use esta cuenta.
            </Text>

            <TouchableOpacity style={styles.accountSettingsRemoveButton} onPress={onRemoveCurrentAccount}>
              <Text style={styles.accountSettingsRemoveText}>Quitar cuenta</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <SafeAreaView style={styles.scannerSafe}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Escanear QR</Text>
            <TouchableOpacity style={styles.scannerCloseButton} onPress={() => setScannerVisible(false)}>
              <Text style={styles.scannerCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.scannerWrap}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => onQrScanned(data)}
            />
          </View>

          <Text style={styles.scannerHelp}>Escanea el QR de cuenta o de pairing MFA.</Text>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showApprovalNumberModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowApprovalNumberModal(false);
          setApprovalChallenge(null);
          setApprovalNumberInput('');
        }}
      >
        <View style={styles.blockingOverlay}>
          <View style={styles.approvalModalCard}>
            <Text style={styles.approvalModalTitle}>Confirmar número de inicio de sesión</Text>
            <Text style={styles.approvalModalText}>
              Ingresa el número de 2 dígitos (01-99) que ves en la pantalla de login web para aprobar.
            </Text>

            <TextInput
              style={styles.approvalNumberInput}
              keyboardType="number-pad"
              maxLength={2}
              value={approvalNumberInput}
              onChangeText={(value) => setApprovalNumberInput(value.replace(/[^0-9]/g, ''))}
              placeholder="00"
              placeholderTextColor="#8CA0BC"
            />

            <View style={styles.approvalModalActions}>
              <TouchableOpacity
                style={styles.approvalCancelButton}
                onPress={() => {
                  setShowApprovalNumberModal(false);
                  setApprovalChallenge(null);
                  setApprovalNumberInput('');
                }}
              >
                <Text style={styles.approvalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.approvalConfirmButton} onPress={confirmApproveWithNumber}>
                <Text style={styles.approvalConfirmText}>Aprobar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {working && (
        <View style={styles.blockingOverlay}>
          <View style={styles.blockingCard}>
            <ActivityIndicator size="large" color="#0A78D1" />
            <Text style={styles.blockingText}>{workingMessage}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F2F2' },
  header: {
    backgroundColor: '#0A78D1',
    height: 74,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  headerTitle: { color: '#fff', fontSize: 48 / 2, fontWeight: '800', marginLeft: 8 },
  headerActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { color: '#fff', fontSize: 24, fontWeight: '700' },

  listContainer: { flex: 1, backgroundColor: '#F2F2F2' },
  rowSection: { borderBottomWidth: 1, borderBottomColor: '#DEDEDE', backgroundColor: '#F2F2F2' },
  accountRow: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  accountRowActive: { backgroundColor: '#EAF4FF' },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#D9D9D9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { color: '#444', fontWeight: '700', fontSize: 15 },
  accountInfo: { flex: 1 },
  accountName: { color: '#111', fontSize: 18, fontWeight: '500' },
  accountMeta: { color: '#5E5E5E', fontSize: 15, marginTop: 2 },
  chevron: { color: '#B2B2B2', fontSize: 34, marginLeft: 8 },

  codeBlock: {
    paddingLeft: 66,
    paddingRight: 14,
    paddingBottom: 10,
    marginTop: -4,
  },
  codeText: {
    color: '#0A78D1',
    fontSize: 62 / 2,
    fontWeight: '400',
    letterSpacing: 2,
  },
  codeBadge: {
    position: 'absolute',
    right: 14,
    top: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#C7C7C7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F7',
  },
  codeBadgeText: { color: '#0A78D1', fontSize: 16, fontWeight: '500' },
  codeActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  approveButton: { backgroundColor: '#16A34A', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  approveText: { color: '#fff', fontWeight: '700' },
  rejectButton: { backgroundColor: '#DC2626', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  rejectText: { color: '#fff', fontWeight: '700' },

  emptyWrap: { padding: 18 },
  emptyTitle: { fontSize: 19, fontWeight: '700', color: '#222' },
  emptySubtitle: { marginTop: 6, color: '#6E6E6E', fontSize: 15 },

  detailScreen: { backgroundColor: '#F2F2F2' },
  detailTopCard: { backgroundColor: '#0A78D1', paddingHorizontal: 14, paddingBottom: 18, paddingTop: 8 },
  detailTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailIconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  detailHeaderIcon: { color: '#fff', fontSize: 30, fontWeight: '500' },
  detailIdentityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  detailAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D9D9D9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailAvatarText: { color: '#444', fontWeight: '700', fontSize: 22 },
  detailIdentityText: { flex: 1 },
  detailAppName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  detailEmail: { color: '#E4EEF8', fontSize: 16, marginTop: 2 },

  detailSectionHeaderWrap: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#DADADA',
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  detailSectionHeader: { color: '#8A8A8A', fontSize: 15, fontWeight: '500' },

  detailRow: {
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DEDEDE',
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailRowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  detailRowIcon: { color: '#111', fontSize: 16, fontWeight: '700' },
  detailRowTextWrap: { flex: 1 },
  detailRowTitle: { color: '#111', fontSize: 20, fontWeight: '400' },
  detailRowSubtitle: { color: '#4F4F4F', fontSize: 16, marginTop: 2 },

  detailCodeRow: {
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DEDEDE',
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailCodeBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#C7C7C7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F7',
    marginRight: 10,
  },
  detailCodeBadgeText: { color: '#0A78D1', fontSize: 16, fontWeight: '500' },
  detailCodeTextWrap: { flex: 1 },
  detailCodeTitle: { color: '#111', fontSize: 18, fontWeight: '400' },
  detailCodeValue: { color: '#0A78D1', fontSize: 56 / 2, fontWeight: '400', letterSpacing: 1.8, marginTop: 2 },
  detailCopyButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  detailCopyIcon: { color: '#0A78D1', fontSize: 20, fontWeight: '700' },

  detailSimpleAction: {
    backgroundColor: '#F2F2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#DEDEDE',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailSimpleActionText: { color: '#111', fontSize: 19, fontWeight: '400', flex: 1 },
  detailSimpleActionChevron: { color: '#949494', fontSize: 24 },

  detailActionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 8,
    marginTop: 12,
  },

  fab: {
    position: 'absolute',
    right: 18,
    bottom: 86,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#0A78D1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '700' },

  bottomTabs: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 78,
    backgroundColor: '#F9F9F9',
    borderTopWidth: 1,
    borderTopColor: '#D8D8D8',
    flexDirection: 'row',
  },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 22, color: '#8E8E8E' },
  tabIconActive: { color: '#0A78D1' },
  tabLabel: { marginTop: 2, fontSize: 14, color: '#6E6E6E' },
  tabLabelActive: { color: '#0A78D1' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 10,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 4 },
  sheetAction: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  sheetActionText: { color: '#111', fontSize: 16, fontWeight: '600' },
  sheetCancel: { alignItems: 'center', paddingVertical: 10 },
  sheetCancelText: { color: '#0A78D1', fontWeight: '700', fontSize: 16 },

  setupSafe: { flex: 1, backgroundColor: '#081026' },
  setupHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setupTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '800' },
  setupClose: { color: '#93C5FD', fontSize: 16, fontWeight: '700' },
  setupContent: { padding: 16, gap: 10, paddingBottom: 42 },
  setupSection: { color: '#E2E8F0', fontWeight: '700', fontSize: 16, marginBottom: 2 },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  saveButton: { backgroundColor: '#0A78D1', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 2 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#1F2A44', marginVertical: 10 },
  secondaryAction: { backgroundColor: '#334155', borderRadius: 12, padding: 12, alignItems: 'center' },
  secondaryActionText: { color: '#fff', fontWeight: '700' },
  primaryAction: { backgroundColor: '#16A34A', borderRadius: 12, padding: 12, alignItems: 'center' },
  primaryActionText: { color: '#fff', fontWeight: '700' },

  scannerSafe: { flex: 1, backgroundColor: '#020617' },
  scannerHeader: { paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scannerTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  scannerCloseButton: { backgroundColor: '#334155', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  scannerCloseText: { color: '#fff', fontWeight: '700' },
  scannerWrap: {
    flex: 1,
    margin: 14,
    borderRadius: 18,
    overflow: 'hidden',
    borderColor: '#334155',
    borderWidth: 1,
  },
  scannerHelp: { color: '#94A3B8', textAlign: 'center', paddingBottom: 20 },

  accountSettingsSafe: { flex: 1, backgroundColor: '#EAEAEA' },
  accountSettingsHeader: {
    height: 78,
    backgroundColor: '#0A78D1',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  accountSettingsBackButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  accountSettingsBackText: { color: '#fff', fontSize: 40, fontWeight: '400', marginTop: -2 },
  accountSettingsTitle: { color: '#fff', fontSize: 20, fontWeight: '700', flex: 1, textAlign: 'center' },
  accountSettingsHeaderSpacer: { width: 42 },
  accountSettingsContent: { flex: 1 },
  accountSettingsRow: {
    backgroundColor: '#F4F4F4',
    minHeight: 72,
    borderBottomWidth: 1,
    borderBottomColor: '#DADADA',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountSettingsRowLabel: { color: '#111', fontSize: 19, fontWeight: '400', flex: 1, paddingRight: 10 },
  accountSettingsValueWrap: { flexDirection: 'row', alignItems: 'center', maxWidth: '55%' },
  accountSettingsRowValue: { color: '#5C5C5C', fontSize: 18, marginRight: 8 },
  accountSettingsChevron: { color: '#A2A2A2', fontSize: 30, lineHeight: 30 },
  accountSettingsHelp: {
    color: '#7A7A7A',
    fontSize: 16,
    lineHeight: 28,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#EAEAEA',
  },
  accountSettingsRemoveButton: {
    backgroundColor: '#F4F4F4',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#DADADA',
    alignItems: 'center',
    justifyContent: 'center',
    height: 72,
    marginTop: 8,
  },
  accountSettingsRemoveText: { color: '#D62525', fontSize: 22, fontWeight: '400' },

  blockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    minWidth: 210,
  },
  blockingText: {
    marginTop: 10,
    color: '#0F172A',
    fontWeight: '600',
    fontSize: 14,
  },
  approvalModalCard: {
    width: '86%',
    maxWidth: 360,
    borderRadius: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  approvalModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A2C45',
    marginBottom: 8,
  },
  approvalModalText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4B5F79',
    marginBottom: 12,
  },
  manualCodeBox: {
    borderWidth: 1,
    borderColor: '#D9E5F3',
    backgroundColor: '#F6FAFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  manualCodeLabel: {
    fontSize: 12,
    color: '#4B5F79',
    marginBottom: 4,
    fontWeight: '600',
  },
  manualCodeValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#103A63',
    textAlign: 'center',
    letterSpacing: 5,
  },
  approvalNumberInput: {
    borderWidth: 1,
    borderColor: '#C8D4E5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    color: '#103A63',
    letterSpacing: 4,
    marginBottom: 14,
  },
  approvalModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  approvalCancelButton: {
    backgroundColor: '#EFF4FA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  approvalCancelText: {
    color: '#4B5F79',
    fontWeight: '700',
    fontSize: 14,
  },
  approvalConfirmButton: {
    backgroundColor: '#0A78D1',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  approvalConfirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
