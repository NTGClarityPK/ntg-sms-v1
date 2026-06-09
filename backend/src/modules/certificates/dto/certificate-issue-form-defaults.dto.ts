export class CertificateIssueFormDefaultsDto {
  signature1Name!: string;
  signature2Name!: string;
  signature1Label!: string;
  signature2Label!: string;

  constructor(partial: Partial<CertificateIssueFormDefaultsDto>) {
    Object.assign(this, partial);
  }
}
