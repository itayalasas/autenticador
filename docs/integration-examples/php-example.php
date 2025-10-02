<?php
/**
 * Ejemplo de integración con AuthSystem en PHP
 * 
 * Este archivo muestra cómo manejar la autenticación en una aplicación PHP
 */

session_start();

// Configuración de tu aplicación
define('APP_ID', 'app_mk2k3j4h5k6l');
define('API_KEY', 'ak_development_cd9bac61b17b0a09f307afe54e93d40f');
define('AUTH_BASE_URL', 'http://localhost:5173');
define('API_BASE_URL', 'http://localhost:3001/api');
define('CALLBACK_URL', 'http://' . $_SERVER['HTTP_HOST'] . '/auth/callback.php');

class AuthManager {
    
    public function isAuthenticated() {
        return isset($_SESSION['auth_data']) && $this->isTokenValid($_SESSION['auth_data']);
    }
    
    public function getUser() {
        return $_SESSION['auth_data']['user'] ?? null;
    }
    
    public function hasRole($role) {
        $user = $this->getUser();
        return $user && in_array($role, $user['roles']);
    }
    
    public function hasPermission($permission) {
        $user = $this->getUser();
        return $user && in_array($permission, $user['permissions']);
    }
    
    public function login() {
        $loginUrl = AUTH_BASE_URL . '/login?app_id=' . APP_ID . '&callback_url=' . urlencode(CALLBACK_URL);
        header('Location: ' . $loginUrl);
        exit;
    }
    
    public function register() {
        $registerUrl = AUTH_BASE_URL . '/register?app_id=' . APP_ID . '&callback_url=' . urlencode(CALLBACK_URL);
        header('Location: ' . $registerUrl);
        exit;
    }
    
    public function logout() {
        session_destroy();
        header('Location: /');
        exit;
    }
    
    public function handleCallback() {
        try {
            $token = $_GET['token'] ?? null;
            $refreshToken = $_GET['refresh_token'] ?? null;
            $userId = $_GET['user_id'] ?? null;
            $userEmail = $_GET['user_email'] ?? null;
            $userName = $_GET['user_name'] ?? null;
            $state = $_GET['state'] ?? null;
            $expiresIn = intval($_GET['expires_in'] ?? 86400);

            if ($state !== 'success' || !$token) {
                throw new Exception('Autenticación fallida');
            }

            // Validar token con AuthSystem
            if (!$this->validateToken($token)) {
                throw new Exception('Token inválido');
            }

            // Decodificar JWT
            $userData = $this->parseJWT($token);

            // Guardar datos en sesión
            $_SESSION['auth_data'] = [
                'access_token' => $token,
                'refresh_token' => $refreshToken,
                'user' => [
                    'id' => $userId,
                    'email' => $userEmail,
                    'name' => urldecode($userName),
                    'roles' => $userData['roles'] ?? [],
                    'permissions' => $userData['permissions'] ?? [],
                    'metadata' => $userData['metadata'] ?? []
                ],
                'expires_at' => date('Y-m-d H:i:s', time() + $expiresIn)
            ];

            // Redirigir a dashboard
            header('Location: /dashboard.php');
            exit;

        } catch (Exception $e) {
            header('Location: /login.php?error=' . urlencode($e->getMessage()));
            exit;
        }
    }
    
    private function validateToken($token) {
        $data = [
            'token' => $token,
            'application_id' => APP_ID
        ];
        
        $options = [
            'http' => [
                'header' => "Content-type: application/json\r\n" .
                           "X-API-Key: " . API_KEY . "\r\n",
                'method' => 'POST',
                'content' => json_encode($data)
            ]
        ];
        
        $context = stream_context_create($options);
        $result = file_get_contents(API_BASE_URL . '/auth/verify', false, $context);
        
        if ($result === false) {
            return false;
        }
        
        $response = json_decode($result, true);
        return $response['success'] && $response['data']['valid'];
    }
    
    private function parseJWT($token) {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return [];
        }
        
        $payload = base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1]));
        return json_decode($payload, true) ?: [];
    }
    
    private function isTokenValid($authData) {
        if (!isset($authData['expires_at'])) {
            return false;
        }
        return strtotime($authData['expires_at']) > time();
    }
}

// Instanciar el gestor de autenticación
$auth = new AuthManager();

// Determinar qué página mostrar
$page = $_GET['page'] ?? 'home';

switch ($page) {
    case 'login':
        if ($auth->isAuthenticated()) {
            header('Location: /dashboard.php');
            exit;
        }
        ?>
        <!DOCTYPE html>
        <html>
        <head>
            <title>Login - Mi Aplicación</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                button { background: #3b82f6; color: white; padding: 15px 30px; border: none; border-radius: 8px; cursor: pointer; margin: 10px; font-size: 16px; }
                button:hover { background: #2563eb; }
                .info { background: #f0f9ff; border: 1px solid #0ea5e9; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: left; }
            </style>
        </head>
        <body>
            <h1>🔐 Iniciar Sesión</h1>
            <p>Haz clic para autenticarte con AuthSystem</p>
            
            <button onclick="window.location.href='?action=login'">🔑 Iniciar Sesión</button>
            <button onclick="window.location.href='?action=register'">📝 Registrarse</button>
            
            <div class="info">
                <h3>💡 Información de Integración</h3>
                <p><strong>App ID:</strong> <?= APP_ID ?></p>
                <p><strong>Callback URL:</strong> <?= CALLBACK_URL ?></p>
                <p><strong>AuthSystem URL:</strong> <?= AUTH_BASE_URL ?></p>
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
        ?>
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard - Mi Aplicación</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                .user-info { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .success { background: #f0fdf4; border: 1px solid #22c55e; color: #16a34a; padding: 15px; border-radius: 8px; }
                .admin-panel { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
                button { background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; margin: 5px; }
                button:hover { background: #2563eb; }
                .logout { background: #ef4444; }
                .logout:hover { background: #dc2626; }
            </style>
        </head>
        <body>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h1>🏠 Dashboard</h1>
                <button class="logout" onclick="window.location.href='?action=logout'">🚪 Cerrar Sesión</button>
            </div>

            <div class="success">
                <h2>✅ ¡Autenticación Exitosa!</h2>
            </div>

            <div class="user-info">
                <h2>👤 Información del Usuario</h2>
                <p><strong>ID:</strong> <code><?= htmlspecialchars($user['id']) ?></code></p>
                <p><strong>Nombre:</strong> <?= htmlspecialchars($user['name']) ?></p>
                <p><strong>Email:</strong> <?= htmlspecialchars($user['email']) ?></p>
                <p><strong>Roles:</strong> <?= implode(', ', $user['roles']) ?></p>
                <p><strong>Permisos:</strong> <?= implode(', ', $user['permissions']) ?></p>
            </div>

            <?php if ($auth->hasRole('admin')): ?>
            <div class="admin-panel">
                <h3>🔧 Panel de Administración</h3>
                <p>Solo visible para administradores</p>
                <button>Gestionar Usuarios</button>
                <button>Configuración</button>
            </div>
            <?php endif; ?>

            <?php if ($auth->hasPermission('write')): ?>
            <div class="user-info">
                <h3>✏️ Acciones de Escritura</h3>
                <p>Tienes permisos para modificar datos</p>
                <button>Crear Contenido</button>
                <button>Editar Datos</button>
            </div>
            <?php endif; ?>

            <div class="user-info">
                <h3>🔍 Datos de Sesión</h3>
                <p><strong>Token:</strong> <code><?= substr($_SESSION['auth_data']['access_token'], 0, 20) ?>...</code></p>
                <p><strong>Expira:</strong> <?= $_SESSION['auth_data']['expires_at'] ?></p>
            </div>
        </body>
        </html>
        <?php
        break;

    default:
        if ($auth->isAuthenticated()) {
            header('Location: /?page=dashboard');
            exit;
        } else {
            header('Location: /?page=login');
            exit;
        }
}

// Manejar acciones
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
        case 'callback':
            $auth->handleCallback();
            break;
    }
}

// Si estamos en la URL de callback, procesarla
if (strpos($_SERVER['REQUEST_URI'], '/auth/callback') !== false || isset($_GET['token'])) {
    $auth->handleCallback();
}
?>