export type IdCardDesignVariant = 'classic' | 'minimal';

export const ID_CARD_DESIGN_VARIANTS: IdCardDesignVariant[] = ['classic', 'minimal'];

export function isIdCardDesignVariant(v: string): v is IdCardDesignVariant {
  return ID_CARD_DESIGN_VARIANTS.includes(v as IdCardDesignVariant);
}

/** Legacy cards may still store `modern`; treat as classic. */
export function normalizeIdCardDesignVariant(v: string | undefined): IdCardDesignVariant {
  const lower = (v ?? '').toLowerCase();
  if (lower === 'modern') return 'classic';
  if (isIdCardDesignVariant(lower)) return lower;
  return 'classic';
}
