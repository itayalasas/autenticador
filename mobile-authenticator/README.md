# AuthSystem Mobile Authenticator (MVP)

Proyecto móvil separado para aprobación de 2FA estilo Authenticator.

## Flujo MVP

1. Usuario inicia sesión en la web.
2. Si la app tiene `enable_two_factor=true` y el usuario tiene dispositivo registrado, `auth-login` responde `MFA_REQUIRED` con `challenge_id` y `challenge_code`.
3. Mobile app lista desafíos pendientes (`mfa-list-pending-challenges`).
4. Usuario aprueba el desafío en el móvil (`mfa-approve-challenge`).
5. Web hace polling a `mfa-check-challenge` hasta obtener `approved` y tokens/callback.

## Pairing del dispositivo

1. En móvil: login del usuario + solicitar token QR (`mfa-generate-pairing-token`).
2. En móvil: registrar dispositivo con token (`mfa-register-device`).

## Setup rápido

```bash
cd mobile-authenticator
npm install
npm run start
```

> Nota: este MVP deja el escaneo QR real para la siguiente iteración. De momento se puede pegar el `pairing_token` manualmente.
