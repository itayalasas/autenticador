import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as LocalAuthentication from 'expo-local-authentication';
import { listPendingChallenges, approveChallenge, generatePairingToken, registerDevice } from './src/services/api';
import { AppProfile, loadProfiles, removeProfile, upsertProfile } from './src/services/profiles';
import { loadBiometricApprovalEnabled, saveBiometricApprovalEnabled } from './src/services/settings';

const SUPABASE_URL = 'https://sfqtmnncgiqkveaoqckt.supabase.co';

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

export default function App() {
  const [profiles, setProfiles] = useState<AppProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>('authenticator');
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);

  const [appName, setAppName] = useState('');
  const [baseUrl, setBaseUrl] = useState(SUPABASE_URL);
  const [applicationId, setApplicationId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pairingToken, setPairingToken] = useState('');
  const [deviceName, setDeviceName] = useState('Mi teléfono');
  const [deviceId, setDeviceId] = useState(createDeviceId());

  const [challenges, setChallenges] = useState<any[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [working, setWorking] = useState(false);
  const [workingMessage, setWorkingMessage] = useState('Procesando...');

  const [scannerVisible, setScannerVisible] = useState(false);
  const [isScannerLocked, setIsScannerLocked] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [requireBiometricApproval, setRequireBiometricApproval] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const storedProfiles = await loadProfiles();
      const biometricPreference = await loadBiometricApprovalEnabled();

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const hasEnrollment = await LocalAuthentication.isEnrolledAsync();
      const supportedMethods = await LocalAuthentication.supportedAuthenticationTypesAsync();

      setBiometricSupported(hasHardware && supportedMethods.length > 0);
      setBiometricEnrolled(hasEnrollment);
      setRequireBiometricApproval(biometricPreference);

      setProfiles(storedProfiles);
      if (storedProfiles.length > 0) {
        applyProfile(storedProfiles[0]);
      }
    };

    bootstrap();
  }, []);

  const applyProfile = (profile: AppProfile) => {
    setActiveProfileId(profile.id);
    setAppName(profile.appName || '');
    setBaseUrl(profile.baseUrl || SUPABASE_URL);
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
      baseUrl: baseUrl || SUPABASE_URL,
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
    const updated = await removeProfile(profile.id);
    setProfiles(updated);

    if (activeProfileId === profile.id) {
      setActiveProfileId(null);
      if (updated.length > 0) {
        applyProfile(updated[0]);
      }
    }
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
    const resolvedBaseUrl = input.baseUrl || baseUrl || SUPABASE_URL;

    const existingProfile = profiles.find((item) => item.applicationId === resolvedApplicationId && item.email === resolvedEmail);
    const now = new Date().toISOString();

    const profile: AppProfile = {
      id: existingProfile?.id || activeProfileId || createLocalId(),
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

    if (parsed.applicationId && parsed.apiKey) {
      setShowSetupModal(true);
      Alert.alert('QR leído', 'Datos de cuenta detectados. Revisa y guarda la cuenta.');
      return;
    }

    if (parsed.pairingToken) {
      setWorkingMessage('Vinculando cuenta...');
      setWorking(true);
      try {
        const resolvedBaseUrl = parsed.baseUrl || baseUrl || SUPABASE_URL;
        const result = await registerDevice({
          baseUrl: resolvedBaseUrl,
          pairing_token: parsed.pairingToken,
          device_id: deviceId,
          device_name: deviceName,
        });

        if (!result.success) throw new Error(result.error?.message || 'No se pudo registrar dispositivo');

        await saveLinkedProfile({
          applicationId: result.data?.application?.application_id || parsed.applicationId,
          appName: result.data?.application?.name || parsed.appName,
          email: result.data?.user?.email || parsed.email,
          password: parsed.password,
          apiKey: result.data?.application?.api_key || parsed.apiKey,
          baseUrl: resolvedBaseUrl,
        });

        Alert.alert('Cuenta vinculada', 'Dispositivo registrado y cuenta agregada al Authenticator.');
      } catch (error: any) {
        if (parsed.pairingToken) setPairingToken(parsed.pairingToken);
        setShowSetupModal(true);
        Alert.alert('Vinculación manual', error.message || 'No se pudo vincular automáticamente. Completa el registro manual.');
      } finally {
        setWorking(false);
      }
      return;
    }

    Alert.alert('QR leído', 'No se detectaron datos compatibles.');
  };

  const credentials = useMemo(
    () => ({
      baseUrl: baseUrl || SUPABASE_URL,
      application_id: applicationId,
      api_key: apiKey,
      email,
      password,
    }),
    [baseUrl, applicationId, apiKey, email, password]
  );

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
      setBaseUrl(profile.baseUrl || SUPABASE_URL);
      setApplicationId(profile.applicationId || '');
      setApiKey(profile.apiKey || '');
      setEmail(profile.email || '');
      setPassword(profile.password || '');
    }

    setLoadingChallenges(true);
    try {
      const result = await listPendingChallenges({
        baseUrl: profile.baseUrl || SUPABASE_URL,
        application_id: profile.applicationId,
        api_key: profile.apiKey,
        email: profile.email,
        password: profile.password,
      });
      if (!result.success) throw new Error(result.error?.message || 'No se pudieron cargar solicitudes');
      setChallenges(result.data?.challenges || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error cargando solicitudes');
    } finally {
      setLoadingChallenges(false);
    }
  };

  const toggleBiometricRequirement = async () => {
    if (!requireBiometricApproval) {
      if (!biometricSupported) {
        Alert.alert('No disponible', 'Este dispositivo no tiene biometría disponible.');
        return;
      }

      if (!biometricEnrolled) {
        Alert.alert('Biometría no configurada', 'Configura Face ID/huella en el dispositivo para habilitar esta opción.');
        return;
      }
    }

    const nextValue = !requireBiometricApproval;
    setRequireBiometricApproval(nextValue);
    await saveBiometricApprovalEnabled(nextValue);
  };

  const verifyBiometricForApproval = async (): Promise<boolean> => {
    if (!requireBiometricApproval) return true;

    if (!biometricSupported) {
      Alert.alert('No disponible', 'Este dispositivo no soporta autenticación biométrica.');
      return false;
    }

    if (!biometricEnrolled) {
      Alert.alert('Biometría no configurada', 'Debes configurar Face ID/huella para aprobar con un toque.');
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirma aprobación MFA',
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar código',
    });

    if (!result.success) {
      const errorCode = 'error' in result ? result.error : undefined;
      if (errorCode !== 'user_cancel') {
        Alert.alert('Verificación fallida', 'No fue posible confirmar identidad biométrica.');
      }
      return false;
    }

    return true;
  };

  const onResolveChallenge = async (challenge: any, action: 'approve' | 'reject') => {
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
        baseUrl: profile.baseUrl || SUPABASE_URL,
        application_id: profile.applicationId,
        api_key: profile.apiKey,
        email: profile.email,
        password: profile.password,
        challenge_id: challenge.id,
        challenge_code: challenge.challenge_code,
        action,
      });
      if (!result.success) throw new Error(result.error?.message || 'No se pudo procesar solicitud');
      Alert.alert('OK', action === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada');
      await onLoadChallenges(profile);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error procesando solicitud');
    } finally {
      setWorking(false);
    }
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
        baseUrl: profile.baseUrl || SUPABASE_URL,
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
      const result = await registerDevice({
        baseUrl: baseUrl || SUPABASE_URL,
        pairing_token: pairingToken,
        device_id: deviceId,
        device_name: deviceName,
      });
      if (!result.success) throw new Error(result.error?.message || 'No se pudo registrar dispositivo');

      await saveLinkedProfile({
        applicationId: result.data?.application?.application_id || applicationId,
        appName: result.data?.application?.name || appName,
        email: result.data?.user?.email || email,
        apiKey: result.data?.application?.api_key || apiKey,
        baseUrl,
      });

      Alert.alert('OK', 'Dispositivo registrado para MFA y cuenta vinculada.');
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

                return (
                  <View key={profile.id} style={styles.rowSection}>
                    <TouchableOpacity
                      style={[styles.accountRow, isActive ? styles.accountRowActive : undefined]}
                      onPress={() => {
                        applyProfile(profile);
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
                        <Text style={styles.codeText}>{highlightedChallenge.challenge_code}</Text>
                        <View style={styles.codeBadge}>
                          <Text style={styles.codeBadgeText}>10</Text>
                        </View>
                        <View style={styles.codeActions}>
                          <TouchableOpacity
                            style={styles.approveButton}
                            onPress={() => {
                              setActiveProfileId(profile.id);
                              onResolveChallenge(highlightedChallenge, 'approve');
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
});
