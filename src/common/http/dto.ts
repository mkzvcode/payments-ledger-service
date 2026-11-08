import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsInt,
  IsISO4217CurrencyCode,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const lowercase = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.toLowerCase() : value;

export class CreateAccountDto {
  @ApiProperty({ example: 'customer-alice', maxLength: 128 })
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/)
  ownerId!: string;

  @ApiProperty({ example: 'RUB' })
  @IsISO4217CurrencyCode()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;
}

export class AmountDto {
  @ApiProperty({
    example: '15000',
    description: 'Positive integer string in minor units; never a JSON number',
    pattern: '^[1-9][0-9]{0,18}$',
  })
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  amount!: string;

  @ApiProperty({ example: 'RUB' })
  @IsISO4217CurrencyCode()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;
}

export class CreateTransferDto extends AmountDto {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @Transform(lowercase)
  @IsUUID()
  fromAccountId!: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  @Transform(lowercase)
  @IsUUID()
  toAccountId!: string;
}

export class EntriesQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ description: 'Opaque nextCursor from the preceding page' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(/^[A-Za-z0-9_-]+$/)
  cursor?: string;
}
