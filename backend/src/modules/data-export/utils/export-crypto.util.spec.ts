import { decryptExportJson, encryptExportJson } from './export-crypto.util';
import { sanitizeExportRow } from './sanitize-export-row';

describe('export-crypto.util', () => {
  it('round-trips JSON encryption', () => {
    const payload = JSON.stringify({ sections: { students: [{ id: '1', name: 'Test' }] } });
    const password = 'SecurePass1!extra';
    const { ciphertext, meta } = encryptExportJson(payload, password);
    const decrypted = decryptExportJson(ciphertext, meta, password);
    expect(decrypted).toBe(payload);
  });
});

describe('sanitizeExportRow', () => {
  it('removes denylisted fields', () => {
    const row = sanitizeExportRow({
      id: '1',
      name: 'A',
      password_hash: 'secret',
      api_key: 'key',
    });
    expect(row).toEqual({ id: '1', name: 'A' });
  });

  it('strips stripe fields from subscription rows', () => {
    const row = sanitizeExportRow(
      { id: '1', tenant_id: 't', stripe_customer_id: 'cus_x' },
      { isSubscriptionTable: true },
    );
    expect(row).toEqual({ id: '1', tenant_id: 't' });
  });
});
