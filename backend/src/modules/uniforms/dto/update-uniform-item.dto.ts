import { PartialType } from '@nestjs/mapped-types';
import { CreateUniformItemDto } from './create-uniform-item.dto';

export class UpdateUniformItemDto extends PartialType(CreateUniformItemDto) {}
