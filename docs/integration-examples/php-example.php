<?php
session_start();

define('APP_ID', 'app_mk2k3j4h5k6l');
define('API_KEY', 'tu_api_key_publica');
define('AUTH_BASE_URL', 'https://auth.tudominio.com');
define('REDIRECT_URI', 'https://' . ($_SERVER['HTTP_HOST'] ?? 'miapp.com') . '/auth/callback.php');

class AuthManager
{
    public function login(): void
    {
        $url = AUTH_BASE_URL . '/login?app_id=' . urlencode(APP_ID)
            . '&redirect_uri=' . urlencode(REDIRECT_URI)
            . '&api_key=' . urlencode(API_KEY);

        header('Location: ' . $url);
        exit;
    }

    public function register(): void
    {
        $url = AUTH_BASE_URL . '/register?app_id=' . urlencode(APP_ID)
            . '&redirect_uri=' . urlencode(REDIRECT_URI)
            . '&api_key=' . urlencode(API_KEY);

        header('Location: ' . $url);
        exit;
    }

    public function logout(): void
    {
        $_SESSION = [];
        session_destroy();

        header('Location: /?page=login');
        exit;
    }

    public function handleCallback(): void
    {
        try {
            $code = $_GET['code'] ?? null;
            $state = $_GET['state'] ?? null;

            if ($state !== 'authenticated' || !$code) {
                throw new Exception('Callback invalido');
            }

            $result = $this->exchangeCode($code);

            if (empty($result['success'])) {
                throw new Exception($result['error']['message'] ?? 'No se pudo intercambiar el code');
            }

            $expiresIn = intval($result['data']['expires_in'] ?? 86400);

            $_SESSION['auth_data'] = [
                'access_token' => $result['data']['access_token'],
                'refresh_token' => $result['data']['refresh_token'],
                'token_type' => $result['data']['token_type'] ?? 'Bearer',
                'expires_at' => date('Y-m-d H:i:s', time() + $expiresIn),
                'user' => $result['data']['user'] ?? [],
                'application' => $result['data']['application'] ?? ['id' => APP_ID]
            ];

            header('Location: /?page=dashboard');
            exit;
        } catch (Exception $e) {
            header('Location: /?page=login&error=' . urlencode($e->getMessage()));
            exit;
        }
    }

    public function isAuthenticated(): bool
    {
        return isset($_SESSION['auth_data']) && $this->isTokenValid($_SESSION['auth_data']);
    }

    public function getUser(): array
    {
        return $_SESSION['auth_data']['user'] ?? [];
    }

    public function hasRole(string $role): bool
    {
        $user = $this->getUser();
        return ($user['role'] ?? null) === $role;
    }

    public function hasPermission(string $menuSlug, string $action = 'read'): bool
    {
        $user = $this->getUser();
        $permissions = $user['permissions'] ?? [];

        return isset($permissions[$menuSlug]) && in_array($action, $permissions[$menuSlug], true);
    }

    private function exchangeCode(string $code): array
    {
        $payload = json_encode([
            'code' => $code,
            'application_id' => APP_ID
        ]);

        $ch = curl_init(AUTH_BASE_URL . '/functions/v1/auth-exchange-code');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json']
        ]);

        $response = curl_exec($ch);

        if ($response === false) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new Exception('No se pudo conectar con AuthSystem: ' . $error);
        }

        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $decoded = json_decode($response, true);

        if (!is_array($decoded)) {
            throw new Exception('Respuesta invalida del servidor');
        }

        if ($httpCode >= 400 || empty($decoded['success'])) {
            throw new Exception($decoded['error']['message'] ?? 'Error al intercambiar el code');
        }

        return $decoded;
    }

    private function isTokenValid(array $authData): bool
    {
        if (!isset($authData['expires_at'])) {
            return false;
        }

        return strtotime($authData['expires_at']) > time();
    }
}

$auth = new AuthManager();

if (isset($_GET['action'])) {
    switch ($_GET['action']) {
        case 'login':
            $auth->login();
            break;
        case 'register':
            $auth->register();
            break;
        case 'logout':
            $auth->logout();
            break;
    }
}

if (isset($_GET['code'])) {
    $auth->handleCallback();
}

$page = $_GET['page'] ?? 'login';

switch ($page) {
    case 'login':
        if ($auth->isAuthenticated()) {
            header('Location: /?page=dashboard');
            exit;
        }
        ?>
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login - Mi Aplicacion</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                button { background: #3b82f6; color: white; padding: 15px 30px; border: none; border-radius: 8px; cursor: pointer; margin: 10px; font-size: 16px; }
                button:hover { background: #2563eb; }
                .info { background: #f0f9ff; border: 1px solid #0ea5e9; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: left; }
                .error { background: #fef2f2; border: 1px solid #ef4444; color: #b91c1c; padding: 12px 16px; border-radius: 8px; margin: 16px 0; }
            </style>
        </head>
        <body>
            <h1>Iniciar sesion</h1>
            <p>Haz clic para autenticarte con AuthSystem usando <code>redirect_uri</code> + <code>code</code>.</p>

            <?php if (!empty($_GET['error'])): ?>
                <div class="error"><?= htmlspecialchars($_GET['error']) ?></div>
            <?php endif; ?>

            <button onclick="window.location.href='?action=login'">Iniciar sesion</button>
            <button onclick="window.location.href='?action=register'">Registrarse</button>

            <div class="info">
                <h3>Informacion de integracion</h3>
                <p><strong>App ID:</strong> <?= htmlspecialchars(APP_ID) ?></p>
                <p><strong>Redirect URI:</strong> <?= htmlspecialchars(REDIRECT_URI) ?></p>
                <p><strong>AuthSystem URL:</strong> <?= htmlspecialchars(AUTH_BASE_URL) ?></p>
            </div>
        </body>
        </html>
        <?php
        break;

    case 'dashboard':
        if (!$auth->isAuthenticated()) {
            header('Location: /?page=login');
            exit;
        }

        $user = $auth->getUser();
        $sessionData = $_SESSION['auth_data'];
        ?>
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Dashboard - Mi Aplicacion</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                .user-info { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .success { background: #f0fdf4; border: 1px solid #22c55e; color: #16a34a; padding: 15px; border-radius: 8px; }
                .admin-panel { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
                button { background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; margin: 5px; }
                button:hover { background: #2563eb; }
                .logout { background: #ef4444; }
                .logout:hover { background: #dc2626; }
                pre { background: #111827; color: #e5e7eb; padding: 16px; border-radius: 8px; overflow-x: auto; }
            </style>
        </head>
        <body>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h1>Dashboard</h1>
                <button class="logout" onclick="window.location.href='?action=logout'">Cerrar sesion</button>
            </div>

            <div class="success">
                <h2>Autenticacion exitosa</h2>
            </div>

            <div class="user-info">
                <h2>Informacion del usuario</h2>
                <p><strong>ID:</strong> <code><?= htmlspecialchars($user['id'] ?? '') ?></code></p>
                <p><strong>Nombre:</strong> <?= htmlspecialchars($user['name'] ?? '') ?></p>
                <p><strong>Email:</strong> <?= htmlspecialchars($user['email'] ?? '') ?></p>
                <p><strong>Rol:</strong> <?= htmlspecialchars($user['role'] ?? 'user') ?></p>
                <p><strong>Aplicacion:</strong> <?= htmlspecialchars($sessionData['application']['id'] ?? APP_ID) ?></p>
            </div>

            <?php if ($auth->hasRole('admin')): ?>
            <div class="admin-panel">
                <h3>Panel de administracion</h3>
                <p>Solo visible para administradores.</p>
                <button>Gestionar usuarios</button>
                <button>Configuracion</button>
            </div>
            <?php endif; ?>

            <?php if ($auth->hasPermission('dashboard', 'read')): ?>
            <div class="user-info">
                <h3>Permiso de lectura</h3>
                <p>Tienes acceso al modulo dashboard.</p>
                <button>Ver dashboard</button>
            </div>
            <?php endif; ?>

            <div class="user-info">
                <h3>Datos de sesion</h3>
                <p><strong>Token:</strong> <code><?= htmlspecialchars(substr($sessionData['access_token'] ?? '', 0, 20)) ?>...</code></p>
                <p><strong>Expira:</strong> <?= htmlspecialchars($sessionData['expires_at'] ?? '') ?></p>
                <pre><?= htmlspecialchars(json_encode($user['permissions'] ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) ?></pre>
            </div>
        </body>
        </html>
        <?php
        break;

    default:
        header('Location: /?page=login');
        exit;
}
?>
