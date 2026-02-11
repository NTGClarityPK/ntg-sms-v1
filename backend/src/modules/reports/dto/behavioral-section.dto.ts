/** Attribute average for a period (e.g. month). */
export class BehavioralAttributeAverageDto {
  constructor(partial: Partial<BehavioralAttributeAverageDto>) {
    Object.assign(this, partial);
  }

  attributeName!: string;
  average!: number;
  count!: number;
}

/** Period (e.g. month) with attribute averages. */
export class BehavioralPeriodDto {
  constructor(partial: Partial<BehavioralPeriodDto>) {
    Object.assign(this, partial);
  }

  period!: string; // e.g. "2026-02"
  attributes!: BehavioralAttributeAverageDto[];
}

export class BehavioralSectionDto {
  constructor(partial: Partial<BehavioralSectionDto>) {
    Object.assign(this, partial);
  }

  periods!: BehavioralPeriodDto[];
}
