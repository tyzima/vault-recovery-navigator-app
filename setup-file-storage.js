#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Setting up Vault Recovery Navigator with File-Based Storage\n');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Please run this script from the project root directory');
  process.exit(1);
}

async function runCommand(command, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} in ${cwd}`);
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.log(stderr);
      }
      console.log(stdout);
      resolve(stdout);
    });
  });
}

async function setup() {
  try {
    console.log('📦 Installing frontend dependencies...');
    await runCommand('npm install');

    console.log('\n📦 Installing backend dependencies...');
    const serverDir = path.join(process.cwd(), 'server');
    
    // Create server directory if it doesn't exist
    if (!fs.existsSync(serverDir)) {
      fs.mkdirSync(serverDir);
    }

    // Change to server directory and install
    await runCommand('npm install', serverDir);

    console.log('\n📁 Creating data directory...');
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }

    console.log('\n✅ Setup complete!\n');
    console.log('🔧 To start the application:');
    console.log('   1. Start the backend: npm run server');
    console.log('   2. Start the frontend: npm run dev');
    console.log('   3. Open http://localhost:8080 in your browser');
    console.log('\n🔑 Default login: admin@vault.local / admin123');
    console.log('\n📂 Your data will be stored in: ./data/');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setup(); 