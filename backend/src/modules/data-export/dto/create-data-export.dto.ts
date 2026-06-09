import {
  Equals,
  IsIn,
  IsString,
  Matches,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'backupPasswordsMatch', async: false })
class BackupPasswordsMatchConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as CreateDataExportDto;
    return obj.backupPassword === obj.confirmBackupPassword;
  }

  defaultMessage(): string {
    return 'Backup passwords do not match';
  }
}

export class CreateDataExportDto {
  @IsString()
  @MinLength(1)
  accountPassword!: string;

  @IsString()
  @MinLength(12)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'Backup password must include uppercase, lowercase, a number, and a symbol',
  })
  backupPassword!: string;

  @IsString()
  @MinLength(12)
  @Validate(BackupPasswordsMatchConstraint)
  confirmBackupPassword!: string;

  @IsIn(['tenant', 'branch'])
  scope!: 'tenant' | 'branch';

  @Equals(true, { message: 'You must acknowledge the security warning' })
  acknowledgedWarning!: boolean;
}
