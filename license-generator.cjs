#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// RSA key pair for signing licenses
const RSA_KEY_SIZE = 2048;
const KEYS_DIR = './license-keys';
const PRIVATE_KEY_FILE = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_FILE = path.join(KEYS_DIR, 'public.pem');

// Ensure keys directory exists
if (!fs.existsSync(KEYS_DIR)) {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
}

// Generate RSA key pair if they don't exist
function generateKeyPair() {
  if (fs.existsSync(PRIVATE_KEY_FILE) && fs.existsSync(PUBLIC_KEY_FILE)) {
    console.log('✓ Key pair already exists');
    return;
  }

  console.log('🔑 Generating RSA key pair...');
  
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: RSA_KEY_SIZE,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  fs.writeFileSync(PRIVATE_KEY_FILE, privateKey);
  fs.writeFileSync(PUBLIC_KEY_FILE, publicKey);
  
  console.log('✓ Key pair generated successfully');
  console.log(`  Private key: ${PRIVATE_KEY_FILE}`);
  console.log(`  Public key: ${PUBLIC_KEY_FILE}`);
}

// Sign license data with private key
function signLicense(licenseData) {
  const privateKey = fs.readFileSync(PRIVATE_KEY_FILE, 'utf8');
  const dataToSign = JSON.stringify(licenseData);
  
  const signature = crypto.sign('RSA-SHA256', Buffer.from(dataToSign), {
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
  });
  
  return signature.toString('base64');
}

// Generate license
function generateLicense(options) {
  const {
    customerId,
    maxRunbooks = 10,
    validityDays = 365,
    features = ['runbook_creation', 'runbook_execution']
  } = options;

  const currentTime = Math.floor(Date.now() / 1000);
  const expirationTime = currentTime + (validityDays * 24 * 60 * 60);

  const licenseData = {
    customer_id: customerId,
    max_runbooks: maxRunbooks,
    issued_at: currentTime,
    expires_at: expirationTime,
    features: features
  };

  const signature = signLicense(licenseData);
  
  const license = {
    ...licenseData,
    signature: signature
  };

  return license;
}

// Create license key (base64 encoded JSON)
function createLicenseKey(license) {
  return Buffer.from(JSON.stringify(license)).toString('base64');
}

// Display public key in format for embedding in code
function displayPublicKeyForEmbedding() {
  const publicKey = fs.readFileSync(PUBLIC_KEY_FILE, 'utf8');
  const base64Key = Buffer.from(publicKey).toString('base64');
  
  // Split into segments for obfuscation
  const segments = [];
  const segmentLength = 32;
  for (let i = 0; i < base64Key.length; i += segmentLength) {
    segments.push(base64Key.substr(i, segmentLength));
  }

  console.log('\n📋 Public Key Segments for Code Embedding:');
  console.log('const PUBLIC_KEY_SEGMENTS = [');
  segments.forEach(segment => {
    console.log(`  '${segment}',`);
  });
  console.log('];');
}

// CLI Interface
function showHelp() {
  console.log(`
🔐 License Generator for Vault Recovery Navigator

USAGE:
  node license-generator.js <command> [options]

COMMANDS:
  generate        Generate a new license key
  keys           Generate RSA key pair
  embed          Show public key format for code embedding
  help           Show this help message

GENERATE OPTIONS:
  --customer-id <id>      Customer identifier (required)
  --max-runbooks <num>    Maximum runbooks allowed (default: 10)  
  --validity-days <days>  License validity in days (default: 365)
  --features <list>       Comma-separated feature list

EXAMPLES:
  # Generate key pair
  node license-generator.js keys

  # Generate license for customer
  node license-generator.js generate --customer-id "ACME-Corp-2024" --max-runbooks 50

  # Generate license with custom features
  node license-generator.js generate \\
    --customer-id "TechCorp" \\
    --max-runbooks 25 \\
    --validity-days 180 \\
    --features "runbook_creation,runbook_execution,advanced_features"
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = {};

  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--customer-id':
        options.customerId = value;
        break;
      case '--max-runbooks':
        options.maxRunbooks = parseInt(value);
        break;
      case '--validity-days':
        options.validityDays = parseInt(value);
        break;
      case '--features':
        options.features = value.split(',').map(f => f.trim());
        break;
    }
  }

  return { command, options };
}

// Main execution
function main() {
  const { command, options } = parseArgs();

  switch (command) {
    case 'keys':
      generateKeyPair();
      break;

    case 'generate':
      if (!options.customerId) {
        console.error('❌ Error: --customer-id is required');
        process.exit(1);
      }
      
      generateKeyPair(); // Ensure keys exist
      
      const license = generateLicense(options);
      const licenseKey = createLicenseKey(license);
      
      console.log('\n✅ License Generated Successfully!');
      console.log('\n📄 License Details:');
      console.log(`  Customer ID: ${license.customer_id}`);
      console.log(`  Max Runbooks: ${license.max_runbooks}`);
      console.log(`  Issued: ${new Date(license.issued_at * 1000).toISOString()}`);
      console.log(`  Expires: ${new Date(license.expires_at * 1000).toISOString()}`);
      console.log(`  Features: ${license.features.join(', ')}`);
      
      console.log('\n🔑 License Key (share this with customer):');
      console.log(`${licenseKey}`);
      
      // Save to file
      const filename = `license-${license.customer_id}-${Date.now()}.txt`;
      fs.writeFileSync(filename, licenseKey);
      console.log(`\n💾 License key saved to: ${filename}`);
      break;

    case 'embed':
      if (!fs.existsSync(PUBLIC_KEY_FILE)) {
        console.error('❌ Error: Public key not found. Run "keys" command first.');
        process.exit(1);
      }
      displayPublicKeyForEmbedding();
      break;

    case 'help':
    default:
      showHelp();
      break;
  }
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
});

main(); 