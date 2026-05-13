# AuthSystem Mobile Authenticator (MVP)

Proyecto móvil separado para aprobación de 2FA estilo Authenticator.

## Flujo MVP

1. Usuario inicia sesión en la web.
2. Si la app tiene `enable_two_factor=true` y el usuario tiene dispositivo registrado, `auth-login` responde `MFA_REQUIRED` con `challenge_id` y `challenge_code`.
3. Mobile app lista desafíos pendientes (`mfa-list-pending-challenges`).
4. Usuario aprueba el desafío en el móvil (`mfa-approve-challenge`).
5. Web hace polling a `mfa-check-challenge` hasta obtener `approved` y tokens/callback.

## Vinculación del dispositivo

1. En la web se genera un QR y un `pairing_code` corto y legible.
2. En móvil puedes escanear el QR o escribir manualmente el código de vinculación.
3. La app registra el dispositivo con `mfa-register-device`, recibe un `device_token` privado y luego usa ese token para consultar y aprobar MFA sin guardar la contraseña.

## Setup rápido

```bash
cd mobile-authenticator
npm install
```

## Probar en un telefono fisico

1. Crea un `.env` local a partir de `./.env.example`.
2. Ajusta `EXPO_PUBLIC_SUPABASE_URL` a tu backend real o a la IP LAN de tu Supabase local.
3. Para iPhone, usa primero el modo mas confiable:

```bash
npm run dev:go:tunnel:clear
```

Si quieres probar en la misma red y ya tienes Expo Go abierto, tambien puedes usar:

```bash
npm run dev:go
```

Si el QR sigue abriendo la pagina web o el telefono no llega al bundle, limpia la cache y usa tunnel:

```bash
npm run dev:go:clear
```

```bash
npm run dev:go:tunnel
```

Si quieres probar por LAN:

```bash
npm run dev:lan
```

Si ya tienes un development build instalado en el telefono:

```bash
npm run dev:client
```

> Nota: ahora el flujo principal ya es de codigo de vinculacion. Si pegas un QR antiguo con `pairing_token`, la app sigue siendo compatible.
> Importante: si pruebas contra un backend local, la URL debe ser accesible desde el telefono. `localhost` no funciona en un movil fisico.
> En iPhone, si abres la Camara y solo ves Safari, toca "Open in Expo Go" o abre primero Expo Go y usa su escaner interno. Para pruebas fisicas, `dev:go:tunnel:clear` suele ser el arranque mas estable.
