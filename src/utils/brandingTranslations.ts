export type BrandingLanguage = 'es' | 'en' | 'pt';

export const BRANDING_LANGUAGE_OPTIONS: Array<{
  value: BrandingLanguage;
  label: string;
  description: string;
}> = [
  {
    value: 'es',
    label: 'Español',
    description: 'Ideal para experiencias en español de Latinoamérica'
  },
  {
    value: 'en',
    label: 'English',
    description: 'Clear copy for global and B2B authentication flows'
  },
  {
    value: 'pt',
    label: 'Português',
    description: 'Copy optimizado para Brasil y equipos lusófonos'
  }
];

export const MESSAGE_TRANSLATIONS: Record<BrandingLanguage, {
  message_loading_text: string;
  message_success_text: string;
  message_error_text: string;
  message_error_help_text: string;
  processing_text: string;
}> = {
  es: {
    message_loading_text: 'Validando tu acceso...',
    message_success_text: 'Acceso verificado. Te estamos redirigiendo.',
    message_error_text: 'No pudimos validar tus credenciales.',
    message_error_help_text: 'Revisa tu información e inténtalo nuevamente.',
    processing_text: 'Procesando...'
  },
  en: {
    message_loading_text: 'Verifying your access...',
    message_success_text: 'Access confirmed. Redirecting you now.',
    message_error_text: 'We could not validate your credentials.',
    message_error_help_text: 'Please review your information and try again.',
    processing_text: 'Processing...'
  },
  pt: {
    message_loading_text: 'Validando seu acesso...',
    message_success_text: 'Acesso confirmado. Redirecionando agora.',
    message_error_text: 'Não foi possível validar suas credenciais.',
    message_error_help_text: 'Revise suas informações e tente novamente.',
    processing_text: 'Processando...'
  }
};

export const FORM_TEXT_TRANSLATIONS: Record<BrandingLanguage, Record<string, string>> = {
  es: {
    login_title: 'Iniciar sesión',
    login_subtitle: 'Accede con tu cuenta segura',
    login_email_label: 'Correo electrónico',
    login_email_placeholder: 'tu@empresa.com',
    login_password_label: 'Contraseña',
    login_password_placeholder: 'Ingresa tu contraseña',
    login_button_text: 'Continuar',
    login_forgot_password_text: '¿Olvidaste tu contraseña?',
    login_register_link_text: '¿No tienes cuenta? Crear acceso',
    login_success_message: 'Acceso correcto',
    login_error_message: 'Correo o contraseña incorrectos',

    register_title: 'Crear cuenta',
    register_subtitle: 'Configura tu acceso en menos de un minuto',
    register_name_label: 'Nombre completo',
    register_name_placeholder: 'Tu nombre y apellido',
    register_email_label: 'Correo electrónico',
    register_email_placeholder: 'tu@empresa.com',
    register_password_label: 'Contraseña',
    register_password_placeholder: 'Crea una contraseña segura',
    register_confirm_password_label: 'Confirmar contraseña',
    register_confirm_password_placeholder: 'Repite tu contraseña',
    register_button_text: 'Crear cuenta',
    register_login_link_text: '¿Ya tienes una cuenta? Inicia sesión',
    register_success_message: 'Cuenta creada correctamente',
    register_error_message: 'No pudimos crear tu cuenta',

    reset_title: 'Recuperar contraseña',
    reset_subtitle: 'Te enviaremos instrucciones para restablecer tu acceso',
    reset_email_label: 'Correo electrónico',
    reset_email_placeholder: 'tu@empresa.com',
    reset_button_text: 'Enviar instrucciones',
    reset_login_link_text: 'Volver al inicio de sesión',
    reset_success_message: 'Correo de recuperación enviado',
    reset_error_message: 'No pudimos enviar el correo de recuperación',

    confirm_reset_title: 'Crear nueva contraseña',
    confirm_reset_subtitle: 'Define una contraseña nueva para tu cuenta',
    confirm_reset_password_label: 'Nueva contraseña',
    confirm_reset_password_placeholder: 'Escribe la nueva contraseña',
    confirm_reset_confirm_password_label: 'Confirmar nueva contraseña',
    confirm_reset_confirm_password_placeholder: 'Repite la nueva contraseña',
    confirm_reset_button_text: 'Actualizar contraseña',
    confirm_reset_success_message: 'Contraseña actualizada',
    confirm_reset_error_message: 'No pudimos actualizar tu contraseña',

    register_tenant_step1_title: 'Datos de la empresa',
    register_tenant_step1_subtitle: 'Cuentanos como se llama tu organizacion',
    register_tenant_step2_title: 'Cuenta administradora',
    register_tenant_step2_subtitle: 'Crea el acceso principal para gestionar la empresa',
    register_tenant_continue_button: 'Continuar',
    register_tenant_submit_button: 'Registrar empresa',
    register_tenant_login_link: 'Ya tienes una cuenta? Inicia sesion',

    loading_text: 'Cargando...',
    processing_text: 'Procesando...',
    security_badge_text: 'AuthSystem',
    password_mismatch_error: 'Las contraseñas no coinciden',
    role_selection_label: 'Tipo de usuario',
    role_selection_placeholder: 'Selecciona un rol',
    role_selection_description: 'Elige el nivel de acceso que necesitas'
  },
  en: {
    login_title: 'Sign in',
    login_subtitle: 'Access your secure account',
    login_email_label: 'Email address',
    login_email_placeholder: 'you@company.com',
    login_password_label: 'Password',
    login_password_placeholder: 'Enter your password',
    login_button_text: 'Continue',
    login_forgot_password_text: 'Forgot your password?',
    login_register_link_text: "Don't have an account? Create one",
    login_success_message: 'Access granted',
    login_error_message: 'Incorrect email or password',

    register_title: 'Create account',
    register_subtitle: 'Set up secure access in under a minute',
    register_name_label: 'Full name',
    register_name_placeholder: 'Your full name',
    register_email_label: 'Email address',
    register_email_placeholder: 'you@company.com',
    register_password_label: 'Password',
    register_password_placeholder: 'Create a secure password',
    register_confirm_password_label: 'Confirm password',
    register_confirm_password_placeholder: 'Repeat your password',
    register_button_text: 'Create account',
    register_login_link_text: 'Already have an account? Sign in',
    register_success_message: 'Account created successfully',
    register_error_message: 'We could not create your account',

    reset_title: 'Recover password',
    reset_subtitle: 'We will send instructions to restore your access',
    reset_email_label: 'Email address',
    reset_email_placeholder: 'you@company.com',
    reset_button_text: 'Send instructions',
    reset_login_link_text: 'Back to sign in',
    reset_success_message: 'Recovery email sent',
    reset_error_message: 'We could not send the recovery email',

    confirm_reset_title: 'Create new password',
    confirm_reset_subtitle: 'Set a new password for your account',
    confirm_reset_password_label: 'New password',
    confirm_reset_password_placeholder: 'Enter the new password',
    confirm_reset_confirm_password_label: 'Confirm new password',
    confirm_reset_confirm_password_placeholder: 'Repeat the new password',
    confirm_reset_button_text: 'Update password',
    confirm_reset_success_message: 'Password updated',
    confirm_reset_error_message: 'We could not update your password',

    register_tenant_step1_title: 'Company details',
    register_tenant_step1_subtitle: 'Tell us about your organization',
    register_tenant_step2_title: 'Administrator account',
    register_tenant_step2_subtitle: 'Create the main account to manage your workspace',
    register_tenant_continue_button: 'Continue',
    register_tenant_submit_button: 'Register company',
    register_tenant_login_link: 'Already have an account? Sign in',

    loading_text: 'Loading...',
    processing_text: 'Processing...',
    security_badge_text: 'AuthSystem',
    password_mismatch_error: 'Passwords do not match',
    role_selection_label: 'User type',
    role_selection_placeholder: 'Select a role',
    role_selection_description: 'Choose the access level you need'
  },
  pt: {
    login_title: 'Entrar',
    login_subtitle: 'Acesse sua conta segura',
    login_email_label: 'E-mail',
    login_email_placeholder: 'voce@empresa.com',
    login_password_label: 'Senha',
    login_password_placeholder: 'Digite sua senha',
    login_button_text: 'Continuar',
    login_forgot_password_text: 'Esqueceu sua senha?',
    login_register_link_text: 'Ainda não tem conta? Criar acesso',
    login_success_message: 'Acesso liberado',
    login_error_message: 'E-mail ou senha incorretos',

    register_title: 'Criar conta',
    register_subtitle: 'Configure seu acesso seguro em menos de um minuto',
    register_name_label: 'Nome completo',
    register_name_placeholder: 'Seu nome completo',
    register_email_label: 'E-mail',
    register_email_placeholder: 'voce@empresa.com',
    register_password_label: 'Senha',
    register_password_placeholder: 'Crie uma senha segura',
    register_confirm_password_label: 'Confirmar senha',
    register_confirm_password_placeholder: 'Repita sua senha',
    register_button_text: 'Criar conta',
    register_login_link_text: 'Já tem uma conta? Entrar',
    register_success_message: 'Conta criada com sucesso',
    register_error_message: 'Não foi possível criar sua conta',

    reset_title: 'Recuperar senha',
    reset_subtitle: 'Vamos enviar instruções para restaurar seu acesso',
    reset_email_label: 'E-mail',
    reset_email_placeholder: 'voce@empresa.com',
    reset_button_text: 'Enviar instruções',
    reset_login_link_text: 'Voltar para o login',
    reset_success_message: 'E-mail de recuperação enviado',
    reset_error_message: 'Não foi possível enviar o e-mail de recuperação',

    confirm_reset_title: 'Criar nova senha',
    confirm_reset_subtitle: 'Defina uma nova senha para sua conta',
    confirm_reset_password_label: 'Nova senha',
    confirm_reset_password_placeholder: 'Digite a nova senha',
    confirm_reset_confirm_password_label: 'Confirmar nova senha',
    confirm_reset_confirm_password_placeholder: 'Repita a nova senha',
    confirm_reset_button_text: 'Atualizar senha',
    confirm_reset_success_message: 'Senha atualizada',
    confirm_reset_error_message: 'Não foi possível atualizar sua senha',

    register_tenant_step1_title: 'Dados da empresa',
    register_tenant_step1_subtitle: 'Conte como sua organizacao se chama',
    register_tenant_step2_title: 'Conta administradora',
    register_tenant_step2_subtitle: 'Crie o acesso principal para gerenciar a empresa',
    register_tenant_continue_button: 'Continuar',
    register_tenant_submit_button: 'Registrar empresa',
    register_tenant_login_link: 'Ja tem uma conta? Entrar',

    loading_text: 'Carregando...',
    processing_text: 'Processando...',
    security_badge_text: 'AuthSystem',
    password_mismatch_error: 'As senhas não coincidem',
    role_selection_label: 'Tipo de usuário',
    role_selection_placeholder: 'Selecione um papel',
    role_selection_description: 'Escolha o nível de acesso necessário'
  }
};

export function getLanguageFromCustomTexts(customTexts?: Record<string, unknown>): BrandingLanguage {
  const language = customTexts?.__language;
  return language === 'en' || language === 'pt' ? language : 'es';
}
