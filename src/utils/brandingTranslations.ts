export type BrandingLanguage = 'es' | 'en';

export const MESSAGE_TRANSLATIONS: Record<BrandingLanguage, {
  message_loading_text: string;
  message_success_text: string;
  message_error_text: string;
  message_error_help_text: string;
  processing_text: string;
}> = {
  es: {
    message_loading_text: 'Autenticando...',
    message_success_text: '¡Bienvenido! Redirigiendo al dashboard...',
    message_error_text: 'Credenciales inválidas. Verifica tu email y contraseña.',
    message_error_help_text: 'Por favor revisa tus credenciales e intenta nuevamente.',
    processing_text: 'Procesando...'
  },
  en: {
    message_loading_text: 'Authenticating...',
    message_success_text: 'Welcome back! Redirecting to your dashboard...',
    message_error_text: 'Invalid credentials. Please check your email and password.',
    message_error_help_text: 'Please check your email and password.',
    processing_text: 'Processing...'
  }
};

export const FORM_TEXT_TRANSLATIONS: Record<BrandingLanguage, Record<string, string>> = {
  es: {
    login_title: 'Iniciar Sesión',
    login_subtitle: 'Ingresa tus credenciales',
    login_email_label: 'Email',
    login_email_placeholder: 'tu@email.com',
    login_password_label: 'Contraseña',
    login_password_placeholder: '••••••••',
    login_button_text: 'Iniciar Sesión',
    login_forgot_password_text: '¿Olvidaste tu contraseña?',
    login_register_link_text: '¿No tienes cuenta? Regístrate aquí',
    login_success_message: '¡Bienvenido de vuelta!',
    login_error_message: 'Email o contraseña incorrectos',

    register_title: 'Crear Cuenta',
    register_subtitle: 'Regístrate para comenzar',
    register_name_label: 'Nombre Completo',
    register_name_placeholder: 'Tu nombre completo',
    register_email_label: 'Email',
    register_email_placeholder: 'tu@email.com',
    register_password_label: 'Contraseña',
    register_password_placeholder: '••••••••',
    register_confirm_password_label: 'Confirmar Contraseña',
    register_confirm_password_placeholder: '••••••••',
    register_button_text: 'Crear Cuenta',
    register_login_link_text: '¿Ya tienes cuenta? Inicia sesión',
    register_success_message: 'Cuenta creada exitosamente',
    register_error_message: 'Error al crear la cuenta',

    reset_title: 'Recuperar Contraseña',
    reset_subtitle: 'Te enviaremos un email para recuperar tu contraseña',
    reset_email_label: 'Email',
    reset_email_placeholder: 'tu@email.com',
    reset_button_text: 'Enviar Email de Recuperación',
    reset_login_link_text: '¿Recordaste tu contraseña? Inicia sesión',
    reset_success_message: 'Email de recuperación enviado',
    reset_error_message: 'Error al enviar email de recuperación',

    confirm_reset_title: 'Nueva Contraseña',
    confirm_reset_subtitle: 'Ingresa tu nueva contraseña',
    confirm_reset_password_label: 'Nueva Contraseña',
    confirm_reset_password_placeholder: '••••••••',
    confirm_reset_confirm_password_label: 'Confirmar Nueva Contraseña',
    confirm_reset_confirm_password_placeholder: '••••••••',
    confirm_reset_button_text: 'Cambiar Contraseña',
    confirm_reset_success_message: 'Contraseña actualizada exitosamente',
    confirm_reset_error_message: 'Error al actualizar la contraseña',

    loading_text: 'Cargando...',
    processing_text: 'Procesando...',
    security_badge_text: 'Protegido por AuthSystem',
    password_mismatch_error: 'Las contraseñas no coinciden',

    role_selection_label: 'Tipo de Usuario',
    role_selection_placeholder: 'Selecciona un rol',
    role_selection_description: 'Selecciona el tipo de acceso que necesitas'
  },
  en: {
    login_title: 'Sign In',
    login_subtitle: 'Enter your credentials',
    login_email_label: 'Email',
    login_email_placeholder: 'you@email.com',
    login_password_label: 'Password',
    login_password_placeholder: '••••••••',
    login_button_text: 'Sign In',
    login_forgot_password_text: 'Forgot your password?',
    login_register_link_text: "Don't have an account? Sign up here",
    login_success_message: 'Welcome back!',
    login_error_message: 'Incorrect email or password',

    register_title: 'Create Account',
    register_subtitle: 'Sign up to get started',
    register_name_label: 'Full Name',
    register_name_placeholder: 'Your full name',
    register_email_label: 'Email',
    register_email_placeholder: 'you@email.com',
    register_password_label: 'Password',
    register_password_placeholder: '••••••••',
    register_confirm_password_label: 'Confirm Password',
    register_confirm_password_placeholder: '••••••••',
    register_button_text: 'Create Account',
    register_login_link_text: 'Already have an account? Sign in',
    register_success_message: 'Account created successfully',
    register_error_message: 'Error creating account',

    reset_title: 'Recover Password',
    reset_subtitle: 'We will send you an email to recover your password',
    reset_email_label: 'Email',
    reset_email_placeholder: 'you@email.com',
    reset_button_text: 'Send Recovery Email',
    reset_login_link_text: 'Remembered your password? Sign in',
    reset_success_message: 'Recovery email sent',
    reset_error_message: 'Error sending recovery email',

    confirm_reset_title: 'New Password',
    confirm_reset_subtitle: 'Enter your new password',
    confirm_reset_password_label: 'New Password',
    confirm_reset_password_placeholder: '••••••••',
    confirm_reset_confirm_password_label: 'Confirm New Password',
    confirm_reset_confirm_password_placeholder: '••••••••',
    confirm_reset_button_text: 'Change Password',
    confirm_reset_success_message: 'Password updated successfully',
    confirm_reset_error_message: 'Error updating password',

    loading_text: 'Loading...',
    processing_text: 'Processing...',
    security_badge_text: 'Protected by AuthSystem',
    password_mismatch_error: 'Passwords do not match',

    role_selection_label: 'User Type',
    role_selection_placeholder: 'Select a role',
    role_selection_description: 'Select the access type you need'
  }
};

export function getLanguageFromCustomTexts(customTexts?: Record<string, unknown>): BrandingLanguage {
  const lang = customTexts?.__language;
  return lang === 'en' ? 'en' : 'es';
}
