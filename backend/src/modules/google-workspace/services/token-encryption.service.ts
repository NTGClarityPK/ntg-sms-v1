import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

@Injectable()
export class TokenEncryptionService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(plain: string): string {
    const key = this.getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
      iv.toString('base64url'),
      authTag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  decrypt(cipherText: string): string {
    const key = this.getKey();
    const parts = cipherText.split('.');
    if (parts.length !== 3) {
      throw new ServiceUnavailableException('Invalid encrypted token format');
    }
    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64url');
    const authTag = Buffer.from(tagB64, 'base64url');
    const data = Buffer.from(dataB64, 'base64url');
    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      throw new ServiceUnavailableException('Invalid encrypted token format');
    }
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }

  private getKey(): Buffer {
    const raw = this.configService.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY');
    if (!raw || !raw.trim()) {
      throw new ServiceUnavailableException(
        'Google token encryption key is not configured',
      );
    }
    return this.resolveKey(raw.trim());
  }

  private resolveKey(raw: string): Buffer {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, 'hex');
    }
    const buf = Buffer.alloc(32);
    Buffer.from(raw, 'utf8').copy(buf, 0, 0, 32);
    return buf;
  }
}
