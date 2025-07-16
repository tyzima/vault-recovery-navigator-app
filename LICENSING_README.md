# Cryptographic Licensing System

This repository includes a robust cryptographic licensing system that restricts the number of runbooks users can create based on offline license keys.

## Overview

The licensing system uses RSA-2048 cryptographic signatures to ensure licenses cannot be tampered with or forged. It provides:

- **Offline Validation**: License keys work without internet connectivity
- **Tamper Resistance**: Cryptographic signatures prevent license modification
- **Usage Tracking**: Real-time monitoring of runbook usage vs. license limits
- **Expiration Support**: Time-based license expiration
- **Feature Flags**: Granular control over licensed features

## Architecture

### Components

1. **License Generator** (`license-generator.cjs`): Node.js CLI tool for creating licenses
2. **Licensing Library** (`src/lib/licensing.ts`): Core validation and usage tracking
3. **UI Components** (`src/components/licensing/`): License management interface
4. **Integration Points**: Embedded checks in runbook creation flows

### Security Features

- RSA-2048 cryptographic signatures
- Obfuscated public key storage
- Base64 encoding for additional obfuscation layers
- Embedded license validation in critical paths
- Local storage with encoded keys

## Quick Start

### 1. Generate Key Pair

```bash
node license-generator.cjs keys
```

This creates:
- `license-keys/private.pem`: Used for signing licenses (keep secure!)
- `license-keys/public.pem`: Used for verification (embedded in app)

### 2. Create a License

```bash
node license-generator.cjs generate \
  --customer-id "ACME-Corp-2024" \
  --max-runbooks 50 \
  --validity-days 365
```

### 3. Install License in Application

1. Copy the generated license key
2. Navigate to the License Manager in the app
3. Paste the license key and click "Install License"

## License Generator CLI

### Commands

#### Generate Key Pair
```bash
node license-generator.cjs keys
```

#### Generate License
```bash
node license-generator.cjs generate [options]
```

Options:
- `--customer-id <id>`: Customer identifier (required)
- `--max-runbooks <num>`: Maximum runbooks allowed (default: 10)
- `--validity-days <days>`: License validity in days (default: 365)
- `--features <list>`: Comma-separated feature list

#### Show Public Key for Embedding
```bash
node license-generator.cjs embed
```

### Examples

```bash
# Basic license for 25 runbooks, valid for 1 year
node license-generator.cjs generate \
  --customer-id "TechCorp-001" \
  --max-runbooks 25

# Custom license with specific features and shorter validity
node license-generator.cjs generate \
  --customer-id "StartupXYZ" \
  --max-runbooks 5 \
  --validity-days 90 \
  --features "runbook_creation,basic_support"

# Enterprise license
node license-generator.cjs generate \
  --customer-id "Enterprise-Client-2024" \
  --max-runbooks 500 \
  --validity-days 1095 \
  --features "runbook_creation,runbook_execution,advanced_features,priority_support"
```

## License Format

Licenses are JSON objects with RSA signatures:

```json
{
  "customer_id": "ACME-Corp-2024",
  "max_runbooks": 50,
  "issued_at": 1640995200,
  "expires_at": 1672531200,
  "features": ["runbook_creation", "runbook_execution"],
  "signature": "base64-encoded-rsa-signature"
}
```

The entire license is then base64-encoded for distribution.

## Integration Points

### Runbook Creation Forms

Both `CreateRunbookForm` and `EnhancedCreateRunbookForm` include:

- License validation before form submission
- Usage display showing current/max runbooks
- Visual progress bar and warnings
- Disabled submit button when limit reached

### API Functions

```typescript
// Check if user can create another runbook
const canCreate = await canCreateRunbook(userId);

// Get current usage statistics  
const usage = await getRunbookUsage(userId);

// Validate current license
const validation = await validateLicense();

// Install new license
const success = await installLicense(licenseKey);
```

## Security Considerations

### Tamper Resistance

1. **Public Key Obfuscation**: The RSA public key is split into segments and base64-encoded
2. **Multiple Validation Points**: License checks occur in multiple locations
3. **Cryptographic Signatures**: RSA-PSS signatures prevent license modification
4. **Storage Obfuscation**: Licenses are base64-encoded before local storage

### Limitations

While this system provides good protection against casual tampering:

- **Client-side Validation**: Determined attackers can potentially bypass client-side checks
- **Source Code Access**: With access to source code, the public key can be extracted
- **Browser Developer Tools**: Advanced users might manipulate JavaScript execution

For maximum security in production:
- Consider server-side license validation
- Implement code obfuscation/minification
- Use additional integrity checks
- Monitor for suspicious usage patterns

## Deployment

### Update Public Key in Code

After generating keys, update the public key in `src/lib/licensing.ts`:

```bash
node license-generator.cjs embed
```

Copy the output and replace the `PUBLIC_KEY_SEGMENTS` array.

### Production Checklist

- [ ] Generate production key pair
- [ ] Update embedded public key in code
- [ ] Secure private key storage
- [ ] Test license generation and validation
- [ ] Document customer onboarding process
- [ ] Set up license renewal procedures

## Troubleshooting

### Common Issues

1. **"Invalid license signature"**
   - Ensure public key in code matches private key used for signing
   - Check for license corruption during copy/paste

2. **"No license found"**
   - License may not be installed or browser storage cleared
   - Reinstall license through License Manager

3. **"License expired"**
   - Check system clock
   - Generate new license with extended validity

### Debugging

Enable debug logging by adding to browser console:
```javascript
localStorage.setItem('licensing_debug', 'true');
```

## License Management UI

The `LicenseManager` component provides:

- Current license status display
- Usage statistics and progress bars
- License installation interface
- Expiration warnings
- Feature list display

Access via the application's admin/settings section.

## Best Practices

### For License Generation

1. **Secure Key Storage**: Keep private keys in secure, encrypted storage
2. **Customer Records**: Maintain database of issued licenses
3. **Backup Keys**: Securely backup private keys
4. **Version Control**: Track license generations and renewals

### For Development

1. **Test Licenses**: Use short validity periods for testing
2. **Mock Data**: Create test customers with known license limits
3. **Error Handling**: Test expired/invalid license scenarios
4. **UI Testing**: Verify license status displays correctly

### For Deployment

1. **Environment Separation**: Different keys for dev/staging/production
2. **Key Rotation**: Plan for periodic key rotation
3. **Monitoring**: Track license usage and approaching expirations
4. **Support**: Train support team on license troubleshooting

## Support

For licensing system issues:

1. Check this documentation
2. Review browser console for errors
3. Verify license format and signature
4. Test with known-good license
5. Contact development team with specific error messages

## Future Enhancements

Potential improvements:

- [ ] Server-side license validation
- [ ] Automatic license renewal
- [ ] Usage analytics and reporting  
- [ ] Advanced feature flags
- [ ] Hardware-based licensing
- [ ] Cloud-based license management 