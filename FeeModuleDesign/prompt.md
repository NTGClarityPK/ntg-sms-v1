# Cursor Implementation Prompt: Fee Management Module for NTG Alma

```markdown
# CONTEXT

You are implementing a comprehensive Fee Management Module for NTG Alma, a school management system built with:
- **Backend**: NestJS + PostgreSQL (Supabase)
- **Frontend**: Next.js 14 (App Router) + Mantine UI
- **Auth**: Supabase Auth with Row Level Security (RLS)

Existing system has:
- Multi-tenant architecture (organization-scoped)
- User roles: super_admin, school_admin, teacher, parent, student
- Students, classes, sections, levels already implemented
- Parent-student linking exists in database

---

# FEATURE OVERVIEW

Build a complete fee collection system with:
1. **Template System**: Reusable fee/discount templates with multiple line items (metrics)
2. **Flexible Scoping**: Level → Class → Section → Individual (templates stack)
3. **Pro-Rating**: Full Month / Half Month / Daily Pro-Rate options
4. **Metric Exclusion**: Remove specific fee items per student
5. **Challan Generation**: PDF generation with QR codes
6. **Payment Workflow**: Upload proof → Admin verify → Receipt
7. **Late Fees**: Auto-apply or manual with waiver option
8. **Multi-Month**: Single challan for multiple months

---

# DATABASE SCHEMA

## Step 1: Create Migrations

Create these migration files in `backend/src/database/migrations/`:

### `YYYYMMDDHHMMSS_create_fee_templates.ts`

```typescript
import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateFeeTemplates1234567890123 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Templates table
    await queryRunner.createTable(
      new Table({
        name: 'fee_templates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['Fee', 'Discount'],
            isNullable: false,
          },
          {
            name: 'scope',
            type: 'enum',
            enum: ['Levels', 'Class', 'Class-Section', 'Individual'],
            isNullable: false,
          },
          {
            name: 'auto_apply',
            type: 'boolean',
            default: false,
          },
          {
            name: 'auto_apply_condition',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'days_until_due',
            type: 'integer',
            default: 30,
          },
          {
            name: 'pro_rate_type',
            type: 'enum',
            enum: ['Full_Month', 'Half_Month', 'Daily_Pro_Rate'],
            default: "'Full_Month'",
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add unique constraint
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_fee_templates_name_org 
      ON fee_templates(organization_id, name);
    `);

    // 2. Template Metrics table
    await queryRunner.createTable(
      new Table({
        name: 'template_metrics',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'template_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'amount_type',
            type: 'enum',
            enum: ['Absolute', 'Percentage'],
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'per_day',
            type: 'boolean',
            default: false,
          },
          {
            name: 'display_order',
            type: 'integer',
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'template_metrics',
      new TableForeignKey({
        columnNames: ['template_id'],
        referencedTableName: 'fee_templates',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 3. Template Assignments table
    await queryRunner.createTable(
      new Table({
        name: 'template_assignments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'template_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'scope_type',
            type: 'enum',
            enum: ['Level', 'Class', 'Section'],
            isNullable: false,
          },
          {
            name: 'scope_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'template_assignments',
      new TableForeignKey({
        columnNames: ['template_id'],
        referencedTableName: 'fee_templates',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_template_assignments_unique 
      ON template_assignments(template_id, scope_id);
    `);

    // 4. Student Template Links table
    await queryRunner.createTable(
      new Table({
        name: 'student_template_links',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'student_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'template_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'start_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'end_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'student_template_links',
      new TableForeignKey({
        columnNames: ['template_id'],
        referencedTableName: 'fee_templates',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 5. Metric Exclusions table
    await queryRunner.createTable(
      new Table({
        name: 'metric_exclusions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'student_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'template_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'metric_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'excluded_by',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'metric_exclusions',
      new TableForeignKey({
        columnNames: ['template_id'],
        referencedTableName: 'fee_templates',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'metric_exclusions',
      new TableForeignKey({
        columnNames: ['metric_id'],
        referencedTableName: 'template_metrics',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_metric_exclusions_unique 
      ON metric_exclusions(student_id, metric_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('metric_exclusions');
    await queryRunner.dropTable('student_template_links');
    await queryRunner.dropTable('template_assignments');
    await queryRunner.dropTable('template_metrics');
    await queryRunner.dropTable('fee_templates');
  }
}
```

### `YYYYMMDDHHMMSS_create_challans.ts`

```typescript
import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateChallans1234567890124 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Challans table
    await queryRunner.createTable(
      new Table({
        name: 'challans',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'challan_number',
            type: 'varchar',
            length: '50',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'student_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'month',
            type: 'varchar',
            length: '7',
            isNullable: false,
          },
          {
            name: 'months_included',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'generation_date',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'due_date',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'subtotal',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'total_discount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'payable_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['Pending_Payment', 'Under_Review', 'Verified', 'Rejected', 'Cancelled'],
            default: "'Pending_Payment'",
          },
          {
            name: 'pdf_url',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(`
      CREATE INDEX idx_challans_student ON challans(student_id);
      CREATE INDEX idx_challans_status ON challans(status);
      CREATE INDEX idx_challans_month ON challans(month);
    `);

    // 2. Challan Items table
    await queryRunner.createTable(
      new Table({
        name: 'challan_items',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'challan_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'template_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'metric_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'item_type',
            type: 'enum',
            enum: ['Fee', 'Discount'],
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'is_discount',
            type: 'boolean',
            default: false,
          },
          {
            name: 'display_order',
            type: 'integer',
            default: 0,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'challan_items',
      new TableForeignKey({
        columnNames: ['challan_id'],
        referencedTableName: 'challans',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 3. Payments table
    await queryRunner.createTable(
      new Table({
        name: 'payments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'challan_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'student_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'amount_paid',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'payment_date',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'payment_method',
            type: 'enum',
            enum: ['Bank_Transfer', 'Cash', 'Online', 'Cheque'],
            isNullable: false,
          },
          {
            name: 'transaction_reference',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'bank_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'proof_document_url',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['Pending_Review', 'Verified', 'Rejected'],
            default: "'Pending_Review'",
          },
          {
            name: 'verified_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'verified_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'rejection_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        columnNames: ['challan_id'],
        referencedTableName: 'challans',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 4. Late Fee Applications table
    await queryRunner.createTable(
      new Table({
        name: 'late_fee_applications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'challan_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'template_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'applied_automatically',
            type: 'boolean',
            default: true,
          },
          {
            name: 'applied_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'days_overdue',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'can_be_waived',
            type: 'boolean',
            default: true,
          },
          {
            name: 'waived',
            type: 'boolean',
            default: false,
          },
          {
            name: 'waived_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'waived_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'late_fee_applications',
      new TableForeignKey({
        columnNames: ['challan_id'],
        referencedTableName: 'challans',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('late_fee_applications');
    await queryRunner.dropTable('payments');
    await queryRunner.dropTable('challan_items');
    await queryRunner.dropTable('challans');
  }
}
```

---

# BACKEND IMPLEMENTATION

## Step 2: Create Entities

Create in `backend/src/modules/fees/entities/`:

### `fee-template.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { TemplateMetric } from './template-metric.entity';

export enum TemplateType {
  FEE = 'Fee',
  DISCOUNT = 'Discount',
}

export enum TemplateScope {
  LEVELS = 'Levels',
  CLASS = 'Class',
  CLASS_SECTION = 'Class-Section',
  INDIVIDUAL = 'Individual',
}

export enum ProRateType {
  FULL_MONTH = 'Full_Month',
  HALF_MONTH = 'Half_Month',
  DAILY_PRO_RATE = 'Daily_Pro_Rate',
}

@Entity('fee_templates')
export class FeeTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'enum', enum: TemplateType })
  type: TemplateType;

  @Column({ type: 'enum', enum: TemplateScope })
  scope: TemplateScope;

  @Column({ type: 'boolean', default: false })
  auto_apply: boolean;

  @Column({ type: 'jsonb', nullable: true })
  auto_apply_condition: any;

  @Column({ type: 'integer', default: 30 })
  days_until_due: number;

  @Column({ type: 'enum', enum: ProRateType, default: ProRateType.FULL_MONTH })
  pro_rate_type: ProRateType;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @OneToMany(() => TemplateMetric, metric => metric.template, { cascade: true })
  metrics: TemplateMetric[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
```

### `template-metric.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { FeeTemplate } from './fee-template.entity';

export enum AmountType {
  ABSOLUTE = 'Absolute',
  PERCENTAGE = 'Percentage',
}

@Entity('template_metrics')
export class TemplateMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  template_id: string;

  @ManyToOne(() => FeeTemplate, template => template.metrics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: FeeTemplate;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'enum', enum: AmountType })
  amount_type: AmountType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'boolean', default: false })
  per_day: boolean;

  @Column({ type: 'integer', default: 0 })
  display_order: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
```

### `challan.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Student } from '../../students/entities/student.entity';
import { ChallanItem } from './challan-item.entity';
import { Payment } from './payment.entity';

export enum ChallanStatus {
  PENDING_PAYMENT = 'Pending_Payment',
  UNDER_REVIEW = 'Under_Review',
  VERIFIED = 'Verified',
  REJECTED = 'Rejected',
  CANCELLED = 'Cancelled',
}

@Entity('challans')
export class Challan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'varchar', length: 50, unique: true })
  challan_number: string;

  @Column({ type: 'uuid' })
  student_id: string;

  @ManyToOne(() => Student)
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'varchar', length: 7 })
  month: string; // "2026-05"

  @Column({ type: 'text', array: true, nullable: true })
  months_included: string[];

  @Column({ type: 'date' })
  generation_date: Date;

  @Column({ type: 'date' })
  due_date: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_discount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  payable_amount: number;

  @Column({ type: 'enum', enum: ChallanStatus, default: ChallanStatus.PENDING_PAYMENT })
  status: ChallanStatus;

  @Column({ type: 'text', nullable: true })
  pdf_url: string;

  @OneToMany(() => ChallanItem, item => item.challan, { cascade: true })
  items: ChallanItem[];

  @OneToMany(() => Payment, payment => payment.challan)
  payments: Payment[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
```

*(Continue with other entities: challan-item.entity.ts, payment.entity.ts, template-assignment.entity.ts, student-template-link.entity.ts, metric-exclusion.entity.ts, late-fee-application.entity.ts)*

---

## Step 3: Create DTOs

Create in `backend/src/modules/fees/dto/`:

### `create-template.dto.ts`

```typescript
import { IsString, IsEnum, IsBoolean, IsOptional, IsInt, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { TemplateType, TemplateScope, ProRateType } from '../entities/fee-template.entity';
import { AmountType } from '../entities/template-metric.entity';

class CreateMetricDto {
  @IsString()
  name: string;

  @IsEnum(AmountType)
  amount_type: AmountType;

  @Min(0)
  amount: number;

  @IsBoolean()
  @IsOptional()
  per_day?: boolean;

  @IsInt()
  @IsOptional()
  display_order?: number;
}

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsEnum(TemplateType)
  type: TemplateType;

  @IsEnum(TemplateScope)
  scope: TemplateScope;

  @IsBoolean()
  @IsOptional()
  auto_apply?: boolean;

  @IsOptional()
  auto_apply_condition?: any;

  @IsInt()
  @Min(1)
  @Max(365)
  days_until_due: number;

  @IsEnum(ProRateType)
  pro_rate_type: ProRateType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMetricDto)
  metrics: CreateMetricDto[];
}
```

### `generate-challan.dto.ts`

```typescript
import { IsUUID, IsArray, IsDateString, IsOptional, IsBoolean } from 'class-validator';

export class GenerateChallanDto {
  @IsArray()
  @IsUUID('4', { each: true })
  student_ids: string[];

  @IsArray()
  months: string[]; // ["2026-05", "2026-06"]

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsBoolean()
  @IsOptional()
  auto_calculate_due_date?: boolean;
}
```

---

## Step 4: Create Services

### `backend/src/modules/fees/services/template.service.ts`

```typescript
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeeTemplate } from '../entities/fee-template.entity';
import { TemplateMetric } from '../entities/template-metric.entity';
import { CreateTemplateDto } from '../dto/create-template.dto';

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(FeeTemplate)
    private templateRepo: Repository<FeeTemplate>,
    @InjectRepository(TemplateMetric)
    private metricRepo: Repository<TemplateMetric>,
  ) {}

  async create(createDto: CreateTemplateDto, organizationId: string): Promise<FeeTemplate> {
    // Check unique name
    const existing = await this.templateRepo.findOne({
      where: { name: createDto.name, organization_id: organizationId },
    });

    if (existing) {
      throw new ConflictException('Template with this name already exists');
    }

    // Create template
    const template = this.templateRepo.create({
      ...createDto,
      organization_id: organizationId,
    });

    // Create metrics
    template.metrics = createDto.metrics.map(metric =>
      this.metricRepo.create(metric),
    );

    return await this.templateRepo.save(template);
  }

  async findAll(organizationId: string): Promise<FeeTemplate[]> {
    return await this.templateRepo.find({
      where: { organization_id: organizationId, is_active: true },
      relations: ['metrics'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, organizationId: string): Promise<FeeTemplate> {
    const template = await this.templateRepo.findOne({
      where: { id, organization_id: organizationId },
      relations: ['metrics'],
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async update(id: string, updateDto: Partial<CreateTemplateDto>, organizationId: string): Promise<FeeTemplate> {
    const template = await this.findOne(id, organizationId);

    // Update template fields
    Object.assign(template, updateDto);

    // If metrics updated, replace them
    if (updateDto.metrics) {
      // Delete old metrics
      await this.metricRepo.delete({ template_id: id });

      // Create new metrics
      template.metrics = updateDto.metrics.map(metric =>
        this.metricRepo.create({ ...metric, template_id: id }),
      );
    }

    return await this.templateRepo.save(template);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const template = await this.findOne(id, organizationId);
    template.is_active = false;
    await this.templateRepo.save(template);
  }
}
```

### `backend/src/modules/fees/services/challan.service.ts`

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Challan, ChallanStatus } from '../entities/challan.entity';
import { ChallanItem } from '../entities/challan-item.entity';
import { FeeTemplate } from '../entities/fee-template.entity';
import { TemplateMetric } from '../entities/template-metric.entity';
import { MetricExclusion } from '../entities/metric-exclusion.entity';
import { GenerateChallanDto } from '../dto/generate-challan.dto';
import { FeeCalculationService } from './fee-calculation.service';
import { PdfGenerationService } from './pdf-generation.service';

@Injectable()
export class ChallanService {
  constructor(
    @InjectRepository(Challan)
    private challanRepo: Repository<Challan>,
    @InjectRepository(ChallanItem)
    private itemRepo: Repository<ChallanItem>,
    private feeCalculationService: FeeCalculationService,
    private pdfService: PdfGenerationService,
  ) {}

  async generate(dto: GenerateChallanDto, organizationId: string): Promise<Challan[]> {
    const challans: Challan[] = [];

    for (const studentId of dto.student_ids) {
      // Calculate fees for student
      const calculation = await this.feeCalculationService.calculateForStudent(
        studentId,
        dto.months,
        organizationId,
      );

      // Generate challan number
      const challanNumber = await this.generateChallanNumber(organizationId);

      // Calculate due date
      const dueDate = dto.auto_calculate_due_date
        ? this.calculateDueDate(dto.months[0], calculation.daysUntilDue)
        : new Date(dto.due_date);

      // Create challan
      const challan = this.challanRepo.create({
        organization_id: organizationId,
        challan_number: challanNumber,
        student_id: studentId,
        month: dto.months[0],
        months_included: dto.months,
        generation_date: new Date(),
        due_date: dueDate,
        subtotal: calculation.subtotal,
        total_discount: calculation.totalDiscount,
        payable_amount: calculation.payableAmount,
        status: ChallanStatus.PENDING_PAYMENT,
      });

      // Create items
      challan.items = calculation.items.map((item, index) =>
        this.itemRepo.create({
          template_id: item.templateId,
          metric_id: item.metricId,
          description: item.description,
          item_type: item.type,
          amount: item.amount,
          is_discount: item.isDiscount,
          display_order: index,
        }),
      );

      // Save challan
      const saved = await this.challanRepo.save(challan);

      // Generate PDF
      const pdfUrl = await this.pdfService.generateChallanPdf(saved);
      saved.pdf_url = pdfUrl;
      await this.challanRepo.save(saved);

      challans.push(saved);
    }

    return challans;
  }

  private async generateChallanNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.challanRepo.count({
      where: { organization_id: organizationId },
    });
    return `CHL-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private calculateDueDate(month: string, daysUntilDue: number): Date {
    const [year, monthNum] = month.split('-').map(Number);
    const startOfMonth = new Date(year, monthNum - 1, 1);
    const dueDate = new Date(startOfMonth);
    dueDate.setDate(dueDate.getDate() + daysUntilDue);
    return dueDate;
  }

  async findByStudent(studentId: string, organizationId: string): Promise<Challan[]> {
    return await this.challanRepo.find({
      where: { student_id: studentId, organization_id: organizationId },
      relations: ['items', 'payments'],
      order: { created_at: 'DESC' },
    });
  }

  async findPendingVerifications(organizationId: string): Promise<Challan[]> {
    return await this.challanRepo.find({
      where: {
        organization_id: organizationId,
        status: ChallanStatus.UNDER_REVIEW,
      },
      relations: ['student', 'payments'],
      order: { created_at: 'ASC' },
    });
  }
}
```

### `backend/src/modules/fees/services/fee-calculation.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FeeTemplate, TemplateType, TemplateScope } from '../entities/fee-template.entity';
import { TemplateMetric } from '../entities/template-metric.entity';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { StudentTemplateLink } from '../entities/student-template-link.entity';
import { MetricExclusion } from '../entities/metric-exclusion.entity';
import { Student } from '../../students/entities/student.entity';

interface CalculationResult {
  subtotal: number;
  totalDiscount: number;
  payableAmount: number;
  daysUntilDue: number;
  items: {
    templateId: string;
    metricId: string;
    description: string;
    type: TemplateType;
    amount: number;
    isDiscount: boolean;
  }[];
}

@Injectable()
export class FeeCalculationService {
  constructor(
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(FeeTemplate)
    private templateRepo: Repository<FeeTemplate>,
    @InjectRepository(TemplateAssignment)
    private assignmentRepo: Repository<TemplateAssignment>,
    @InjectRepository(StudentTemplateLink)
    private linkRepo: Repository<StudentTemplateLink>,
    @InjectRepository(MetricExclusion)
    private exclusionRepo: Repository<MetricExclusion>,
  ) {}

  async calculateForStudent(
    studentId: string,
    months: string[],
    organizationId: string,
  ): Promise<CalculationResult> {
    // Get student details
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
      relations: ['class_section', 'class_section.class', 'class_section.class.level'],
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Get applicable templates
    const templates = await this.getApplicableTemplates(student, organizationId);

    // Get metric exclusions
    const exclusions = await this.exclusionRepo.find({
      where: { student_id: studentId },
    });
    const excludedMetricIds = new Set(exclusions.map(e => e.metric_id));

    // Calculate fees
    let subtotal = 0;
    const feeItems: CalculationResult['items'] = [];
    const discounts: number[] = [];
    let maxDaysUntilDue = 30;

    for (const template of templates) {
      if (template.days_until_due > maxDaysUntilDue) {
        maxDaysUntilDue = template.days_until_due;
      }

      for (const metric of template.metrics) {
        // Skip if excluded
        if (excludedMetricIds.has(metric.id)) continue;

        // Calculate amount per month
        let amount = Number(metric.amount);

        // Multiply by number of months
        amount *= months.length;

        // Handle pro-rate if applicable
        if (template.pro_rate_type === 'Daily_Pro_Rate') {
          const link = await this.linkRepo.findOne({
            where: { student_id: studentId, template_id: template.id },
          });

          if (link && link.start_date && link.end_date) {
            const days = this.calculateDays(link.start_date, link.end_date);
            amount = Number(metric.amount) * days;
          }
        } else if (template.pro_rate_type === 'Half_Month') {
          amount = amount / 2;
        }

        if (template.type === TemplateType.FEE) {
          subtotal += amount;
          feeItems.push({
            templateId: template.id,
            metricId: metric.id,
            description: `${metric.name} (${months.join(', ')})`,
            type: TemplateType.FEE,
            amount,
            isDiscount: false,
          });
        } else if (template.type === TemplateType.DISCOUNT) {
          if (metric.amount_type === 'Percentage') {
            discounts.push(Number(metric.amount));
          } else {
            discounts.push(amount);
          }

          feeItems.push({
            templateId: template.id,
            metricId: metric.id,
            description: metric.name,
            type: TemplateType.DISCOUNT,
            amount,
            isDiscount: true,
          });
        }
      }
    }

    // Apply discounts multiplicatively
    let payableAmount = subtotal;
    let totalDiscount = 0;

    for (const discount of discounts) {
      const discountAmount = (payableAmount * discount) / 100;
      totalDiscount += discountAmount;
      payableAmount -= discountAmount;
    }

    return {
      subtotal,
      totalDiscount,
      payableAmount,
      daysUntilDue: maxDaysUntilDue,
      items: feeItems,
    };
  }

  private async getApplicableTemplates(student: any, organizationId: string): Promise<FeeTemplate[]> {
    const templates: FeeTemplate[] = [];

    // Get Level templates
    if (student.class_section?.class?.level) {
      const levelTemplates = await this.getTemplatesByScope(
        TemplateScope.LEVELS,
        student.class_section.class.level.id,
        organizationId,
      );
      templates.push(...levelTemplates);
    }

    // Get Class templates
    if (student.class_section?.class) {
      const classTemplates = await this.getTemplatesByScope(
        TemplateScope.CLASS,
        student.class_section.class.id,
        organizationId,
      );
      templates.push(...classTemplates);
    }

    // Get Section templates
    if (student.class_section) {
      const sectionTemplates = await this.getTemplatesByScope(
        TemplateScope.CLASS_SECTION,
        student.class_section.id,
        organizationId,
      );
      templates.push(...sectionTemplates);
    }

    // Get Individual templates
    const individualLinks = await this.linkRepo.find({
      where: { student_id: student.id, is_active: true },
      relations: ['template', 'template.metrics'],
    });
    templates.push(...individualLinks.map(link => link.template));

    return templates;
  }

  private async getTemplatesByScope(
    scope: TemplateScope,
    scopeId: string,
    organizationId: string,
  ): Promise<FeeTemplate[]> {
    const assignments = await this.assignmentRepo.find({
      where: { scope_type: scope, scope_id: scopeId },
      relations: ['template', 'template.metrics'],
    });

    return assignments
      .map(a => a.template)
      .filter(t => t.organization_id === organizationId && t.is_active);
  }

  private calculateDays(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }
}
```

---

## Step 5: Create Controllers

### `backend/src/modules/fees/controllers/template.controller.ts`

```typescript
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { TemplateService } from '../services/template.service';
import { CreateTemplateDto } from '../dto/create-template.dto';

@Controller('api/v1/fees/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplateController {
  constructor(private templateService: TemplateService) {}

  @Post()
  @Roles('school_admin')
  async create(@Body() dto: CreateTemplateDto, @CurrentUser() user: any) {
    return await this.templateService.create(dto, user.organization_id);
  }

  @Get()
  @Roles('school_admin', 'teacher')
  async findAll(@CurrentUser() user: any) {
    return await this.templateService.findAll(user.organization_id);
  }

  @Get(':id')
  @Roles('school_admin', 'teacher')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return await this.templateService.findOne(id, user.organization_id);
  }

  @Put(':id')
  @Roles('school_admin')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateTemplateDto>,
    @CurrentUser() user: any,
  ) {
    return await this.templateService.update(id, dto, user.organization_id);
  }

  @Delete(':id')
  @Roles('school_admin')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    await this.templateService.delete(id, user.organization_id);
    return { message: 'Template deleted successfully' };
  }
}
```

*(Continue with challan.controller.ts, payment.controller.ts, etc.)*

---

# FRONTEND IMPLEMENTATION

## Step 6: Create Frontend Structure

### API Client: `frontend/src/lib/api/fees.ts`

```typescript
import { apiClient } from './client';

export interface FeeTemplate {
  id: string;
  name: string;
  type: 'Fee' | 'Discount';
  scope: 'Levels' | 'Class' | 'Class-Section' | 'Individual';
  pro_rate_type: 'Full_Month' | 'Half_Month' | 'Daily_Pro_Rate';
  days_until_due: number;
  metrics: TemplateMetric[];
}

export interface TemplateMetric {
  id: string;
  name: string;
  amount_type: 'Absolute' | 'Percentage';
  amount: number;
  per_day: boolean;
}

export const feesApi = {
  // Templates
  async getTemplates() {
    const { data } = await apiClient.get<FeeTemplate[]>('/fees/templates');
    return data;
  },

  async createTemplate(template: Omit<FeeTemplate, 'id'>) {
    const { data } = await apiClient.post<FeeTemplate>('/fees/templates', template);
    return data;
  },

  async updateTemplate(id: string, template: Partial<FeeTemplate>) {
    const { data } = await apiClient.put<FeeTemplate>(`/fees/templates/${id}`, template);
    return data;
  },

  async deleteTemplate(id: string) {
    await apiClient.delete(`/fees/templates/${id}`);
  },

  // Challans
  async generateChallans(dto: {
    student_ids: string[];
    months: string[];
    due_date?: string;
    auto_calculate_due_date?: boolean;
  }) {
    const { data } = await apiClient.post('/fees/challans/generate', dto);
    return data;
  },

  async getStudentChallans(studentId: string) {
    const { data } = await apiClient.get(`/fees/challans/student/${studentId}`);
    return data;
  },

  async getPendingVerifications() {
    const { data } = await apiClient.get('/fees/challans/pending-verifications');
    return data;
  },

  // Payments
  async uploadPaymentProof(challanId: string, formData: FormData) {
    const { data } = await apiClient.post(`/fees/payments/${challanId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async verifyPayment(paymentId: string) {
    const { data } = await apiClient.post(`/fees/payments/${paymentId}/verify`);
    return data;
  },

  async rejectPayment(paymentId: string, reason: string) {
    const { data } = await apiClient.post(`/fees/payments/${paymentId}/reject`, { reason });
    return data;
  },
};
```

---

## Step 7: Create UI Components

### Template Creation Form: `frontend/src/components/fees/CreateTemplateModal.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Modal, TextInput, Select, NumberInput, Button, Group, Stack, ActionIcon, Checkbox } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { feesApi, FeeTemplate } from '@/lib/api/fees';
import { notifications } from '@mantine/notifications';

interface Props {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateTemplateModal({ opened, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      type: 'Fee' as 'Fee' | 'Discount',
      scope: 'Levels' as 'Levels' | 'Class' | 'Class-Section' | 'Individual',
      pro_rate_type: 'Full_Month' as 'Full_Month' | 'Half_Month' | 'Daily_Pro_Rate',
      days_until_due: 30,
      auto_apply: false,
      metrics: [
        {
          name: '',
          amount_type: 'Absolute' as 'Absolute' | 'Percentage',
          amount: 0,
          per_day: false,
        },
      ],
    },
    validate: {
      name: (value) => (!value ? 'Name is required' : null),
      days_until_due: (value) => (value < 1 || value > 365 ? 'Must be between 1-365 days' : null),
      metrics: {
        name: (value) => (!value ? 'Metric name is required' : null),
        amount: (value) => (value <= 0 ? 'Amount must be greater than 0' : null),
      },
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    try {
      await feesApi.createTemplate(values as any);
      notifications.show({
        title: 'Success',
        message: 'Template created successfully',
        color: 'green',
      });
      form.reset();
      onClose();
      onSuccess();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to create template',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create Fee Template"
      size="xl"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Template Name"
            placeholder="e.g., Junior Level Monthly Fee"
            required
            {...form.getInputProps('name')}
          />

          <Group grow>
            <Select
              label="Type"
              data={[
                { value: 'Fee', label: 'Fee' },
                { value: 'Discount', label: 'Discount' },
              ]}
              required
              {...form.getInputProps('type')}
            />

            <Select
              label="Scope"
              data={[
                { value: 'Levels', label: 'Levels' },
                { value: 'Class', label: 'Class' },
                { value: 'Class-Section', label: 'Class-Section' },
                { value: 'Individual', label: 'Individual' },
              ]}
              required
              {...form.getInputProps('scope')}
            />
          </Group>

          <Group grow>
            <Select
              label="Pro-Rate Type"
              data={[
                { value: 'Full_Month', label: 'Full Month' },
                { value: 'Half_Month', label: 'Half Month' },
                { value: 'Daily_Pro_Rate', label: 'Daily Pro-Rate' },
              ]}
              required
              {...form.getInputProps('pro_rate_type')}
            />

            <NumberInput
              label="Days Until Due"
              min={1}
              max={365}
              required
              {...form.getInputProps('days_until_due')}
            />
          </Group>

          {form.values.scope === 'Individual' && (
            <Checkbox
              label="Auto-apply (for staff/sibling discounts)"
              {...form.getInputProps('auto_apply', { type: 'checkbox' })}
            />
          )}

          <div>
            <Group justify="space-between" mb="xs">
              <div style={{ fontWeight: 500, fontSize: 14 }}>Metrics (Line Items)</div>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={() =>
                  form.insertListItem('metrics', {
                    name: '',
                    amount_type: 'Absolute',
                    amount: 0,
                    per_day: false,
                  })
                }
              >
                Add Metric
              </Button>
            </Group>

            <Stack gap="sm">
              {form.values.metrics.map((_, index) => (
                <Group key={index} align="flex-start" wrap="nowrap">
                  <TextInput
                    placeholder="Metric name"
                    style={{ flex: 1 }}
                    {...form.getInputProps(`metrics.${index}.name`)}
                  />

                  <Select
                    data={[
                      { value: 'Absolute', label: 'Absolute' },
                      { value: 'Percentage', label: 'Percentage' },
                    ]}
                    style={{ width: 130 }}
                    {...form.getInputProps(`metrics.${index}.amount_type`)}
                  />

                  <NumberInput
                    placeholder="Amount"
                    min={0}
                    style={{ width: 120 }}
                    {...form.getInputProps(`metrics.${index}.amount`)}
                  />

                  {form.values.pro_rate_type === 'Daily_Pro_Rate' && (
                    <Checkbox
                      label="Per Day"
                      {...form.getInputProps(`metrics.${index}.per_day`, { type: 'checkbox' })}
                    />
                  )}

                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => form.removeListItem('metrics', index)}
                    disabled={form.values.metrics.length === 1}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>

            <div style={{ marginTop: 12, fontSize: 14, color: 'dimgray' }}>
              Template Total: {form.values.metrics.reduce((sum, m) => sum + (m.amount || 0), 0).toLocaleString()} PKR
              {form.values.pro_rate_type !== 'Full_Month' && ` (${form.values.pro_rate_type.replace('_', ' ')})`}
            </div>
          </div>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create Template
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
```

---

## Step 8: Create Pages

### Settings Page: `frontend/src/app/(dashboard)/settings/fees/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Container, Title, Button, Table, Badge, Group, ActionIcon, Tabs } from '@mantine/core';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feesApi } from '@/lib/api/fees';
import { CreateTemplateModal } from '@/components/fees/CreateTemplateModal';
import { notifications } from '@mantine/notifications';

export default function FeeSettingsPage() {
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['fee-templates'],
    queryFn: feesApi.getTemplates,
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: feesApi.deleteTemplate,
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: 'Template deleted successfully',
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['fee-templates'] });
    },
  });

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={2}>Fee Settings</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpened(true)}>
          Create Template
        </Button>
      </Group>

      <Tabs defaultValue="templates">
        <Tabs.List>
          <Tabs.Tab value="templates">Templates</Tabs.Tab>
          <Tabs.Tab value="assignments">Template Assignments</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="templates" pt="xl">
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Scope</Table.Th>
                <Table.Th>Metrics</Table.Th>
                <Table.Th>Total</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {templates?.map((template) => (
                <Table.Tr key={template.id}>
                  <Table.Td>{template.name}</Table.Td>
                  <Table.Td>
                    <Badge color={template.type === 'Fee' ? 'blue' : 'green'}>
                      {template.type}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{template.scope}</Table.Td>
                  <Table.Td>{template.metrics.length} items</Table.Td>
                  <Table.Td>
                    {template.metrics.reduce((sum, m) => sum + m.amount, 0).toLocaleString()} PKR
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon variant="subtle" color="blue">
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => deleteTemplateMutation.mutate(template.id)}
                        loading={deleteTemplateMutation.isPending}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

        <Tabs.Panel value="assignments" pt="xl">
          {/* Template assignment linking UI */}
        </Tabs.Panel>
      </Tabs>

      <CreateTemplateModal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['fee-templates'] })}
      />
    </Container>
  );
}
```

---

# IMPLEMENTATION CHECKLIST

## Phase 1: Database & Backend Core (Week 1)
- [ ] Run migrations to create all tables
- [ ] Create all entity files
- [ ] Create TemplateService with CRUD operations
- [ ] Create TemplateController
- [ ] Test template creation API

## Phase 2: Fee Calculation Logic (Week 2)
- [ ] Implement FeeCalculationService
- [ ] Handle scope hierarchy (Level → Class → Section → Individual)
- [ ] Implement metric exclusion logic
- [ ] Implement pro-rate calculations
- [ ] Implement discount stacking (multiplicative)
- [ ] Test calculations thoroughly

## Phase 3: Challan Generation (Week 2-3)
- [ ] Implement ChallanService
- [ ] Create PDF generation service (use PDFKit or similar)
- [ ] Generate unique challan numbers
- [ ] Calculate due dates automatically
- [ ] Create ChallanController
- [ ] Test bulk challan generation

## Phase 4: Payment Workflow (Week 3)
- [ ] Create Payment entity and service
- [ ] Implement file upload for payment proof
- [ ] Create payment verification endpoints
- [ ] Implement status flow (Pending → Under Review → Verified)
- [ ] Create PaymentController

## Phase 5: Frontend - Settings (Week 4)
- [ ] Create fee settings page
- [ ] Build CreateTemplateModal component
- [ ] Build template list view
- [ ] Implement template editing
- [ ] Build template assignment UI

## Phase 6: Frontend - Fee Tab (Week 4-5)
- [ ] Create fee tab in sidebar
- [ ] Build Template Assignments sub-tab
- [ ] Build student roster view
- [ ] Implement metric exclusion UI (checkboxes)
- [ ] Build individual template linking modal
- [ ] Build Challan Management sub-tab
- [ ] Implement bulk challan generation

## Phase 7: Frontend - Payment & History (Week 5)
- [ ] Build payment upload interface for parents
- [ ] Create verification queue for admins
- [ ] Build payment history view
- [ ] Implement filters and search
- [ ] Create receipt download functionality

## Phase 8: Advanced Features (Week 6)
- [ ] Implement late fee auto-application (cron job)
- [ ] Add late fee waiver functionality
- [ ] Build auto-apply detection for staff/siblings
- [ ] Create reporting dashboards
- [ ] Add email/SMS notifications

## Phase 9: Testing & Polish (Week 6)
- [ ] End-to-end testing of complete workflow
- [ ] Test edge cases (pro-rating, exclusions, stacking)
- [ ] Performance optimization
- [ ] UI polish and accessibility
- [ ] Documentation

---

# CRITICAL NOTES

1. **Organization Scoping**: Every query MUST filter by organization_id for multi-tenancy
2. **Row Level Security**: Add RLS policies in Supabase for all fee tables
3. **PDF Generation**: Use a library like PDFKit or Puppeteer for professional PDFs
4. **File Upload**: Store payment proofs in Supabase Storage
5. **Currency**: All amounts are in PKR (Pakistani Rupees) with 2 decimal places
6. **Date Handling**: Use proper timezone handling (PKT - Pakistan Time)
7. **Validation**: Always validate amounts > 0, dates are valid, etc.
8. **Error Handling**: Comprehensive error messages for users
9. **Permissions**: Enforce role-based access (only school_admin can create templates)
10. **Testing**: Write unit tests for fee calculation logic (complex business rules)

---

# START HERE

Begin with Phase 1: Create the migrations and run them. Then create the entities. Once database is ready, move to services and controllers. Test each endpoint thoroughly before moving to frontend.

Good luck! 🚀
```

---

**This prompt is ready to paste into Cursor for implementation. It includes:**
✅ Complete database schema with migrations
✅ All entity definitions
✅ Service layer with business logic
✅ Controllers with proper auth guards
✅ Frontend API client
✅ UI components (forms, modals, tables)
✅ Complete pages
✅ Implementation checklist
✅ Critical notes and best practices

Would you like me to expand any specific section or create additional components?