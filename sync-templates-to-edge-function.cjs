#!/usr/bin/env node

/**
 * Sync Templates to Edge Function
 *
 * This script reads the TypeScript template files and embeds them
 * into the collect-source-files-complete Edge Function.
 *
 * Run this script whenever you update any template file:
 * node sync-templates-to-edge-function.js
 */

const fs = require('fs');
const path = require('path');

console.log('📦 Syncing templates to Edge Function...\n');

// Read template files
const publicAuthFormsTemplate = fs.readFileSync(
  path.join(__dirname, 'src/utils/publicAuthFormsTemplate.ts'),
  'utf8'
);

const brandedPublicAuthTemplate = fs.readFileSync(
  path.join(__dirname, 'src/utils/brandedPublicAuthTemplate.ts'),
  'utf8'
);

const brandedComponentsTemplate = fs.readFileSync(
  path.join(__dirname, 'src/utils/brandedComponentsTemplate.ts'),
  'utf8'
);

const themePresetsTemplate = fs.readFileSync(
  path.join(__dirname, 'src/utils/themePresetsTemplate.ts'),
  'utf8'
);

// Extract the template strings (they're exported as const TEMPLATE_NAME = `...`)
function extractTemplate(fileContent, templateName) {
  const regex = new RegExp(`export const ${templateName} = \`([\\s\\S]*)\`;?\\s*$`, 'm');
  const match = fileContent.match(regex);
  if (match) {
    return match[1];
  }
  console.error(`❌ Could not find template: ${templateName}`);
  return '';
}

const publicAuthForms = extractTemplate(publicAuthFormsTemplate, 'PUBLIC_AUTH_FORMS_TEMPLATE');
const brandedPublicAuth = extractTemplate(brandedPublicAuthTemplate, 'BRANDED_PUBLIC_AUTH_TEMPLATE');
const brandedComponents = extractTemplate(brandedComponentsTemplate, 'BRANDED_COMPONENTS_TEMPLATE');
const themePresets = extractTemplate(themePresetsTemplate, 'THEME_PRESETS_TEMPLATE');

console.log('✅ Templates extracted:');
console.log(`   - PublicAuthForms: ${publicAuthForms.length} chars`);
console.log(`   - BrandedPublicAuth: ${brandedPublicAuth.length} chars`);
console.log(`   - BrandedComponents: ${brandedComponents.length} chars`);
console.log(`   - ThemePresets: ${themePresets.length} chars`);
console.log('');

// Read the Edge Function
const edgeFunctionPath = path.join(
  __dirname,
  'supabase/functions/collect-source-files-complete/index.ts'
);

let edgeFunctionContent = fs.readFileSync(edgeFunctionPath, 'utf8');

// Find the marker where templates should be inserted
const MARKER_START = '// === TEMPLATES START ===';
const MARKER_END = '// === TEMPLATES END ===';

if (!edgeFunctionContent.includes(MARKER_START)) {
  console.error('❌ Marker not found in Edge Function. Please add:');
  console.error('   // === TEMPLATES START ===');
  console.error('   // === TEMPLATES END ===');
  process.exit(1);
}

// Build the templates section
const templatesSection = `${MARKER_START}
    // Auto-generated from TypeScript template files
    // DO NOT EDIT THIS SECTION MANUALLY
    // Run: node sync-templates-to-edge-function.js to update

    files['src/components/auth/PublicAuthForms.tsx'] = \`${publicAuthForms}\`;

    files['src/components/auth/BrandedPublicAuth.tsx'] = \`${brandedPublicAuth}\`;

    files['src/components/ui/BrandedComponents.tsx'] = \`${brandedComponents}\`;

    files['src/utils/themePresets.ts'] = \`${themePresets}\`;
    ${MARKER_END}`;

// Replace the section
const startIndex = edgeFunctionContent.indexOf(MARKER_START);
const endIndex = edgeFunctionContent.indexOf(MARKER_END) + MARKER_END.length;

if (startIndex === -1 || endIndex === -1) {
  console.error('❌ Could not find template markers in Edge Function');
  process.exit(1);
}

// Find where the legitimate code starts after the markers
// Look for the console.log that marks the end of the file generation section
const legitimateCodeMarker = "console.log('✅ Source collection complete!');";
const legitimateCodeIndex = edgeFunctionContent.indexOf(legitimateCodeMarker);

if (legitimateCodeIndex === -1) {
  console.error('❌ Warning: Could not find legitimate code marker. Old code might remain.');
  console.error('   Looking for:', legitimateCodeMarker);
}

// Replace everything between MARKER_START and the legitimate code
const beforeTemplates = edgeFunctionContent.substring(0, startIndex);
const afterOldCode = legitimateCodeIndex !== -1
  ? '\n\n    ' + edgeFunctionContent.substring(legitimateCodeIndex)
  : edgeFunctionContent.substring(endIndex);

edgeFunctionContent = beforeTemplates + templatesSection + afterOldCode;

// Write back the Edge Function
fs.writeFileSync(edgeFunctionPath, edgeFunctionContent, 'utf8');

console.log('✅ Edge Function updated successfully!');
console.log('');
console.log('📤 Next steps:');
console.log('   1. Deploy the Edge Function: npx supabase functions deploy collect-source-files-complete');
console.log('   2. Test the deployment from Ambientes');
console.log('');
