import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CaisseDto {
  @IsString()
  @IsNotEmpty({ message: 'Le fileId (queueId) est requis.' })
  @MinLength(24)
  @MaxLength(24)
  queueId: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis.' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Le login est requis.' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis.' })
  @MinLength(4)
  password: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class UpdateCaisseDto {
  @ValidateIf(({ value }) => value !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'Le fileId (queueId) ne peut pas être vide.' })
  @MinLength(24)
  @MaxLength(24)
  queueId?: string;

  @ValidateIf(({ value }) => value !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'Le nom ne peut pas être vide.' })
  name?: string;

  @ValidateIf(({ value }) => value !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'Le login ne peut pas être vide.' })
  username?: string;

  @ValidateIf(({ value }) => value !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe ne peut pas être vide.' })
  @MinLength(4)
  password?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}