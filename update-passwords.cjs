#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const newPassword = 'Kelyn2025!';
const dataDir = path.join(__dirname, 'data');

async function updatePasswordFiles() {
  console.log('🔐 Updating password files with new default password...');
  
  try {
    // Generate new hash for the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('✅ Generated new password hash:', hashedPassword);
    
    // Password files to update
    const passwordFiles = [
      'pwd_YWRtaW5AdmF1bHQubG9jYWw=.txt',        // admin@vault.local
      'pwd_cnVuYm9va0BhZG1pbi5jb20=.txt'        // runbook@admin.com
    ];
    
    let updatedCount = 0;
    
    for (const fileName of passwordFiles) {
      const filePath = path.join(dataDir, fileName);
      
      if (fs.existsSync(filePath)) {
        // Backup old file
        const backupPath = filePath + '.backup';
        fs.copyFileSync(filePath, backupPath);
        
        // Write new hash
        fs.writeFileSync(filePath, hashedPassword);
        
        // Decode email from filename for display
        const emailBase64 = fileName.replace('pwd_', '').replace('.txt', '');
        const email = Buffer.from(emailBase64, 'base64').toString();
        
        console.log(`✅ Updated password for: ${email}`);
        console.log(`   📁 File: ${fileName}`);
        console.log(`   💾 Backup: ${fileName}.backup`);
        updatedCount++;
      } else {
        console.log(`⚠️  File not found: ${fileName}`);
      }
    }
    
    console.log(`\n🎉 Successfully updated ${updatedCount} password files!`);
    console.log(`🔑 New password for all admin accounts: ${newPassword}`);
    console.log('\n📋 Updated accounts:');
    console.log('   • admin@vault.local');
    console.log('   • runbook@admin.com');
    
    console.log('\n🚨 IMPORTANT: Commit and push these changes to update your deployed app!');
    console.log('   git add data/pwd_*.txt');
    console.log('   git commit -m "Update default password to Kelyn2025!"');
    console.log('   git push');
    
  } catch (error) {
    console.error('❌ Error updating password files:', error);
    process.exit(1);
  }
}

// Run the update
updatePasswordFiles(); 