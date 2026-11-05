import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsHexColor,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf, ValidateNested
} from 'class-validator';

export class DisplayMediaDto {
  @IsMongoId()
  assetId: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(100)
  mimeType: string;

  @IsIn(['image', 'video'])
  type: 'image' | 'video';
}

export class DisplayConfigDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsHexColor()
  secondaryColor?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['black', 'white'])
  messageColor?: 'black' | 'white';

  @IsString()
  @MinLength(1)
  @MaxLength(3)
  @IsOptional()
  @ValidateIf((_o, v) => v !== undefined)
  separator?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== undefined)
  messages?: string[];

  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => DisplayMediaDto)
  @IsOptional()
  @ValidateIf((_o, v) => v !== undefined)
  media?: DisplayMediaDto[];

  @ValidateNested()
  @Type(() => DisplayMediaDto)
  @IsOptional()
  @ValidateIf((_o, v) => v !== undefined)
  logo?: DisplayMediaDto;
}
