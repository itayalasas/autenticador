/**
 * Script para agregar los servicios faltantes a collect-source-files-complete
 *
 * Este script lee los servicios reales y los agrega a la Edge Function
 */

const fs = require('fs');
const path = require('path');

// Leer los archivos de servicios
const rolesServiceContent = fs.readFileSync('src/services/rolesService.ts', 'utf8');
const applicationServiceContent = fs.readFileSync('src/services/applicationService.ts', 'utf8');
const ipServiceContent = fs.readFileSync('src/services/ipService.ts', 'utf8');
const envConfigServiceContent = fs.readFileSync('src/services/envConfigService.ts', 'utf8');

// Leer otros archivos necesarios
const supabaseLibContent = fs.readFileSync('src/lib/supabase.ts', 'utf8');
const typesContent = fs.readFileSync('src/types/index.ts', 'utf8');

// Escapar backticks y ${} en el contenido
function escapeContent(content) {
  return content
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
}

// Generar las líneas de código para agregar a la Edge Function
const servicesToAdd = `
  // ============================================
  // LIB FILES
  // ============================================

  files['src/lib/supabase.ts'] = \`${escapeContent(supabaseLibContent)}\`;

  // ============================================
  // TYPES
  // ============================================

  files['src/types/index.ts'] = \`${escapeContent(typesContent)}\`;

  // ============================================
  // SERVICES
  // ============================================

  files['src/services/rolesService.ts'] = \`${escapeContent(rolesServiceContent)}\`;

  files['src/services/applicationService.ts'] = \`${escapeContent(applicationServiceContent)}\`;

  files['src/services/ipService.ts'] = \`${escapeContent(ipServiceContent)}\`;

  files['src/services/envConfigService.ts'] = \`${escapeContent(envConfigServiceContent)}\`;
`;

console.log('✅ Servicios preparados para agregar a la Edge Function');
console.log('\n📝 Contenido a agregar:\n');
console.log('Estos servicios deben agregarse después de la línea que dice:');
console.log('  files[\'src/utils/themePresets.ts\'] = ...');
console.log('\nLongitud del código a agregar:', servicesToAdd.length, 'caracteres');

// Guardar en un archivo temporal
fs.writeFileSync('temp-services-to-add.txt', servicesToAdd);
console.log('\n💾 Contenido guardado en: temp-services-to-add.txt');
console.log('\nInstrucciones:');
console.log('1. Abre supabase/functions/collect-source-files-complete/index.ts');
console.log('2. Busca la línea: files[\'src/utils/themePresets.ts\'] = ...');
console.log('3. Después de esa línea, pega el contenido de temp-services-to-add.txt');
console.log('4. Guarda el archivo');
console.log('5. Redeploy la Edge Function');
