import { Logger } from '@nestjs/common';
import {
  hasLegacyEmailDomainPrivilege,
  hasPrivilegedAccess,
  isSuperAdminRole,
} from './privileged-access.util';

describe('privileged-access.util', () => {
  const originalFlag = process.env.ALLOW_EMAIL_DOMAIN_PRIVILEGE_ESCALATION;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.ALLOW_EMAIL_DOMAIN_PRIVILEGE_ESCALATION;
    } else {
      process.env.ALLOW_EMAIL_DOMAIN_PRIVILEGE_ESCALATION = originalFlag;
    }
  });

  it('isSuperAdminRole is case-insensitive', () => {
    expect(isSuperAdminRole(['Super_Admin'])).toBe(true);
    expect(isSuperAdminRole(['school_admin'])).toBe(false);
  });

  it('@ntg.com without super_admin and flag off is not privileged', () => {
    process.env.ALLOW_EMAIL_DOMAIN_PRIVILEGE_ESCALATION = 'false';
    expect(
      hasPrivilegedAccess({ email: 'ops@ntg.com', roles: ['school_admin'] }),
    ).toBe(false);
  });

  it('super_admin with any email is privileged without warn', () => {
    process.env.ALLOW_EMAIL_DOMAIN_PRIVILEGE_ESCALATION = 'false';
    const logger = { warn: jest.fn() } as unknown as Logger;
    expect(
      hasPrivilegedAccess({ email: 'anyone@school.com', roles: ['super_admin'] }, logger),
    ).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('flag on + legacy email is privileged and warns', () => {
    process.env.ALLOW_EMAIL_DOMAIN_PRIVILEGE_ESCALATION = 'true';
    const logger = { warn: jest.fn() } as unknown as Logger;
    expect(
      hasPrivilegedAccess({ email: 'ops@ntg.com', roles: [] }, logger),
    ).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
    expect(hasLegacyEmailDomainPrivilege('ops@ntg.com')).toBe(true);
  });

  it('flag off + super_admin is privileged without warn', () => {
    process.env.ALLOW_EMAIL_DOMAIN_PRIVILEGE_ESCALATION = 'false';
    const logger = { warn: jest.fn() } as unknown as Logger;
    expect(
      hasPrivilegedAccess({ email: 'ops@ntg.com', roles: ['super_admin'] }, logger),
    ).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
