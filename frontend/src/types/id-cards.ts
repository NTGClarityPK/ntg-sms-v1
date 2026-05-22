export type IdCardPersonType = 'student' | 'staff' | 'admin' | 'visitor';

export type IdCardDesignVariant = 'classic' | 'minimal';

export type IdCardStatus = 'draft' | 'approved' | 'printed' | 'issued' | 'revoked';

export type IdCard = {
  id: string;
  branchId: string;
  personId: string;
  personType: IdCardPersonType;
  cardNumber: string;
  templateId?: string;
  photoUrl?: string;
  status: IdCardStatus;
  validFrom?: string;
  validUntil?: string;
  printCount: number;
  lastPrintedAt?: string;
  isReissued: boolean;
  designVariant?: IdCardDesignVariant;
  createdAt: string;
  updatedAt: string;
  personName?: string;
  className?: string;
  sectionName?: string;
  rollNumber?: string;
  hasCard?: boolean;
  hasPhoto: boolean;
};

export type IdCardStudentRecipient = {
  id: string;
  studentId: string;
  firstName: string | null;
  lastName: string | null;
  cardStatus: IdCardStatus | null;
};

export type IdCardClassSectionRecipientsMeta = {
  statusCounts: Partial<Record<IdCardStatus, number>>;
};

export type IdCardTemplate = {
  id: string;
  branchId: string;
  name: string;
  roleType: IdCardPersonType;
  cardSide: 'front' | 'back';
  htmlTemplateKey: string;
  isDefault: boolean;
  isActive: boolean;
};

export type IdCardStats = {
  issued: number;
  pending: number;
  missingPhotos: number;
  draft: number;
};

export type IdCardRenderData = {
  schoolName: string;
  schoolLogoUrl: string;
  academicYearLabel?: string;
  fullName: string;
  roleLabel: string;
  classSection: string;
  rollOrEmployeeId: string;
  cardNumber: string;
  photoUrl: string;
  validFrom: string;
  validUntil: string;
  qrCodeDataUrl: string;
};

export type IdCardGenerationJob = {
  id: string;
  status: string;
  totalCount: number;
  processedCount: number;
  errorMessage: string | null;
  result: { cardIds?: string[] } | null;
};

export type IdCardAnalytics = {
  totalCards: number;
  issued: number;
  reprintCount: number;
  reprintRate: number;
};
