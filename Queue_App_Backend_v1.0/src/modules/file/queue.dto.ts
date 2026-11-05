import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested
} from 'class-validator';
import { DisplayConfigDto } from './display-config.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Payload accepted by the dedicated queue create/update endpoints.
 *
 * All fields are optional here so the same DTO can be used for PATCH.
 * `name` and `code` are enforced manually on create because a PATCH must be
 * able to update only `active` (used by the list toggle).
 */
export class QueueUpsertDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Transform(trim)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Transform(trim)
  code?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(500)
  @Transform(trim)
  description?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  priority?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(8)
  @Transform(trim)
  prefix?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(80)
  @Transform(trim)
  zone?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => DisplayConfigDto)
  display?: DisplayConfigDto;
}
