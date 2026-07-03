# AuthSystem Mobile PKCE - Postman

Archivos:

- `AuthSystem-Mobile-PKCE.postman_collection.json`
- `AuthSystem-Mobile-PKCE.postman_environment.json`

## Que valida

La coleccion cubre dos escenarios:

1. Hosted browser flow usando `GET /authorize`
2. Hosted browser flow usando `GET /oauth/authorize`
3. Direct mobile API flow usando `POST /auth-login`

Ambos usan:

- `channel=mobile`
- `redirect_uri`
- `state`
- `code_challenge`
- `code_challenge_method`
- `code_verifier`

## Variables que debes completar

Antes de ejecutar la coleccion, revisa:

- `auth_base_url`
- `functions_base_url`
- `application_id`
- `api_key`
- `redirect_uri`
- `login_email`
- `login_password`

## Orden recomendado

### Opcion A - Hosted browser flow

1. Ejecuta `Build hosted /authorize URL`
2. Copia `hosted_authorize_url` y abre la URL en navegador o auth session del sistema
3. Completa el login en AuthSystem
4. Copia el query param `code` del deep link o callback final a la variable `auth_code`
5. Ejecuta `Exchange mobile code from hosted browser flow`
6. Ejecuta `Verify mobile access token`

### Opcion A.1 - Hosted browser flow con alias OAuth

1. Ejecuta `Build hosted /oauth/authorize URL`
2. Copia `hosted_oauth_authorize_url` y abre la URL en navegador o auth session del sistema
3. Completa el login en AuthSystem
4. Copia el query param `code` del deep link o callback final a la variable `auth_code`
5. Ejecuta `Exchange mobile code from hosted browser flow`
6. Ejecuta `Verify mobile access token`

### Opcion B - Direct mobile API flow

1. `Direct auth-login (mobile + PKCE)` o `Direct auth-register (mobile + PKCE)`
2. Ejecuta `Exchange should fail with wrong verifier`
3. Ejecuta `Exchange auth_code (mobile PKCE)`
4. Ejecuta `Verify mobile access token`

## Notas utiles

- `GET /authorize` y `GET /oauth/authorize` son rutas publicas hosted del deploy.
- `POST /auth-login` sigue siendo el endpoint backend real en `functions/v1/auth-login`.
- Las requests directas generan PKCE automaticamente en el pre-request script.
- Si `auth-login` o `auth-register` devuelven `callback_url`, la coleccion intenta extraer `auth_code` automaticamente.
- Si la cuenta tiene MFA, `auth-login` puede devolver `202` con `MFA_REQUIRED` o `MFA_SETUP_REQUIRED`.
- La request negativa con verifier incorrecto no deberia consumir el `auth_code`, por eso luego puedes probar el exchange correcto.
