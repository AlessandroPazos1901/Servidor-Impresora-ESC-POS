// start-ngrok.js - Inicia el servidor y ngrok automáticamente
require('dotenv').config();
const ngrok = require('@ngrok/ngrok');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3001;
const NGROK_AUTHTOKEN = process.env.NGROK_AUTHTOKEN;
const NGROK_DOMAIN = process.env.NGROK_DOMAIN;

// Validar authtoken
if (!NGROK_AUTHTOKEN || NGROK_AUTHTOKEN === 'tu_authtoken_aqui') {
  console.error('\n❌ Error: NGROK_AUTHTOKEN no configurado');
  console.error('Por favor, configura tu authtoken en el archivo .env');
  console.error('Obtén tu token en: https://dashboard.ngrok.com/get-started/your-authtoken\n');
  process.exit(1);
}

console.log('🚀 Iniciando servidor de impresión...\n');

// Iniciar servidor Node.js
const serverProcess = spawn('node', ['server.js'], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

serverProcess.on('error', (error) => {
  console.error('❌ Error al iniciar el servidor:', error);
  process.exit(1);
});

// Esperar a que el servidor esté listo antes de iniciar ngrok
setTimeout(async () => {
  try {
    console.log('\n🔗 Iniciando túnel ngrok...\n');

    // Configurar ngrok
    const ngrokConfig = {
      addr: PORT,
      authtoken: NGROK_AUTHTOKEN,
    };

    // Si hay un dominio estático configurado (ngrok Pro)
    if (NGROK_DOMAIN && NGROK_DOMAIN.trim() !== '') {
      ngrokConfig.domain = NGROK_DOMAIN;
      console.log(`📍 Usando dominio estático: ${NGROK_DOMAIN}`);
    }

    // Conectar ngrok
    const listener = await ngrok.forward(ngrokConfig);

    const publicUrl = listener.url();

    console.log('\n✅ Túnel ngrok establecido exitosamente!');
    console.log('━'.repeat(60));
    console.log(`\n🌐 URL Pública: ${publicUrl}`);
    console.log(`🖨️  Puerto local: ${PORT}`);
    console.log('\n🔗 Endpoints públicos:');
    console.log(`   • ${publicUrl}/test (GET)`);
    console.log(`   • ${publicUrl}/print (POST)`);
    console.log(`   • ${publicUrl}/test-print (POST)`);
    console.log('\n💡 Usa esta URL en tu aplicación Vercel');
    console.log('━'.repeat(60));

    // Panel de ngrok
    // if (NGROK_DOMAIN && NGROK_DOMAIN.trim() !== '') {
    //   console.log('\n📊 Dashboard: https://dashboard.ngrok.com');
    //   console.log('⚡ Con ngrok Pro, tu dominio no cambiará entre reinicios');
    // } else {
    //   console.log('\n📊 Dashboard: https://dashboard.ngrok.com');
    //   console.log('⚠️  Nota: Con plan gratuito, la URL cambia en cada reinicio');
    //   console.log('   Considera actualizar a ngrok Pro para un dominio estático');
    // }
    // console.log('\n');

  } catch (error) {
    console.error('\n❌ Error al iniciar ngrok:', error.message);
    console.error('\nPosibles soluciones:');
    console.error('1. Verifica que tu NGROK_AUTHTOKEN sea válido');
    console.error('2. Si usas un dominio estático, verifica que NGROK_DOMAIN sea correcto');
    console.error('3. Revisa tu cuenta en https://dashboard.ngrok.com\n');

    serverProcess.kill();
    process.exit(1);
  }
}, 3000);

// Manejar cierre graceful
process.on('SIGINT', () => {
  console.log('\n\n🛑 Cerrando servidor y túnel ngrok...');
  serverProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Cerrando servidor y túnel ngrok...');
  serverProcess.kill();
  process.exit(0);
});
