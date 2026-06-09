import type { CertificateType } from '../types/certificate.types';
import type { CertificateSignatureLabelsByType } from './certificate-signature-labels.util';
import { isAdministrativeType, isAwardType } from './certificate-type.util';

export type SignatureNameSettingsInput = {
  principalName: string | null;
  registrarName: string | null;
  signatureLabelsByType: CertificateSignatureLabelsByType;
};

function str(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function issueOverrideName(
  data: Record<string, unknown>,
  key: 'signature1Name' | 'signature2Name',
): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(data, key)) return undefined;
  return str(data[key]);
}

/** Names printed above signature lines (issue form may override via certificateData). */
export function resolveSignatureSlotNames(
  certificateType: CertificateType,
  certificateData: Record<string, unknown>,
  settings: SignatureNameSettingsInput,
  classTeacherName: string,
): { signature1Name: string; signature2Name: string } {
  const override1 = issueOverrideName(certificateData, 'signature1Name');
  const override2 = issueOverrideName(certificateData, 'signature2Name');

  if (isAdministrativeType(certificateType)) {
    return {
      signature1Name:
        override1 !== undefined ? override1 : str(settings.registrarName),
      signature2Name:
        override2 !== undefined ? override2 : str(settings.principalName),
    };
  }

  if (isAwardType(certificateType)) {
    return {
      signature1Name:
        override1 !== undefined ? override1 : str(settings.principalName),
      signature2Name:
        override2 !== undefined ? override2 : str(classTeacherName),
    };
  }

  return {
    signature1Name: override1 ?? '',
    signature2Name: override2 ?? '',
  };
}
