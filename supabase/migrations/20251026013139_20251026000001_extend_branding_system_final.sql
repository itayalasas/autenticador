/*
  # Extend Branding System for Advanced Customization

  1. Changes to branding_configs Table
    - Add new columns for extended styling options
    - Card styles, input styles, message styles
    - Animation settings
    - Layout preferences
    - Background effects
    - Message customization

  2. New Features
    - Support for 5 predefined themes (modern-glass, minimal-clean, corporate, gradient-bold, neumorphic)
    - Full control over colors, typography, spacing, shadows
    - Customizable messages for all states (loading, success, error)
    - Animation speed and effects control
    - Background patterns and gradients

  3. Security
    - Maintain existing RLS policies
    - All changes are backward compatible
*/

-- Add new columns to branding_configs table
DO $$
BEGIN
  -- Theme System
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'theme_style'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN theme_style TEXT DEFAULT 'corporate';
  END IF;

  -- Card Styling
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'card_style'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN card_style TEXT DEFAULT 'elevated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'card_background'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN card_background TEXT DEFAULT '#FFFFFF';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'card_blur'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN card_blur INTEGER DEFAULT 0;
  END IF;

  -- Input Styling
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'input_style'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN input_style TEXT DEFAULT 'outlined';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'input_background'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN input_background TEXT DEFAULT '#F9FAFB';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'input_border_color'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN input_border_color TEXT DEFAULT '#D1D5DB';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'input_focus_color'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN input_focus_color TEXT DEFAULT '#3B82F6';
  END IF;

  -- Button Styling
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'button_variant'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN button_variant TEXT DEFAULT 'solid';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'button_size'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN button_size TEXT DEFAULT 'medium';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'button_hover_transform'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN button_hover_transform BOOLEAN DEFAULT true;
  END IF;

  -- Shadow System
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'shadow_intensity'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN shadow_intensity TEXT DEFAULT 'medium';
  END IF;

  -- Color Extensions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'gradient_start'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN gradient_start TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'gradient_end'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN gradient_end TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'error_color'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN error_color TEXT DEFAULT '#EF4444';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'success_color'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN success_color TEXT DEFAULT '#10B981';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'warning_color'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN warning_color TEXT DEFAULT '#F59E0B';
  END IF;

  -- Typography Extensions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'heading_font_family'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN heading_font_family TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'font_size_scale'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN font_size_scale TEXT DEFAULT 'medium';
  END IF;

  -- Background Effects
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'background_pattern'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN background_pattern TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'background_image_url'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN background_image_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'use_gradient'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN use_gradient BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'glass_effect'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN glass_effect BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'blur_background'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN blur_background BOOLEAN DEFAULT false;
  END IF;

  -- Animation Settings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'enable_animations'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN enable_animations BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'animation_speed'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN animation_speed TEXT DEFAULT 'normal';
  END IF;

  -- Layout Settings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'form_width'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN form_width TEXT DEFAULT 'medium';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'spacing'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN spacing TEXT DEFAULT 'normal';
  END IF;

  -- Message Customization
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'message_loading_text'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN message_loading_text TEXT DEFAULT 'Authenticating...';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'message_success_text'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN message_success_text TEXT DEFAULT 'Welcome back! Redirecting...';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'message_error_text'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN message_error_text TEXT DEFAULT 'Invalid credentials. Please try again.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'message_error_help_text'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN message_error_help_text TEXT DEFAULT 'Please check your email and password.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'redirect_delay'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN redirect_delay INTEGER DEFAULT 2000;
  END IF;

  -- Message Colors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'message_loading_bg'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN message_loading_bg TEXT DEFAULT '#3B82F6';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'message_success_bg'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN message_success_bg TEXT DEFAULT '#10B981';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'message_error_bg'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN message_error_bg TEXT DEFAULT '#EF4444';
  END IF;

END $$;

-- Create index for theme_style for faster queries
CREATE INDEX IF NOT EXISTS idx_branding_configs_theme_style ON branding_configs(theme_style);

-- Add comment to table
COMMENT ON TABLE branding_configs IS 'Extended branding configuration with support for multiple themes and complete customization';
