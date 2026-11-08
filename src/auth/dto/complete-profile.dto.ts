import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CompleteProfileDto {
  @ValidateIf((o) => !o.profile_url)
  @IsNotEmpty({ message: 'Profile URL is required' })
  @IsString({ message: 'Profile URL must be a string' })
  profileUrl: string;

  @IsOptional()
  @IsString()
  profile_url?: string;

  @IsString()
  @IsNotEmpty({ message: 'Birthday is required' })
  @Matches(
    /^(\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?|\d{2}[/-]\d{2}[/-]\d{4})$/,
    {
      message:
        'Birthday must be a valid date format (e.g. YYYY-MM-DD or DD/MM/YYYY)',
    },
  )
  birthday: string;

  @IsString()
  @IsNotEmpty({ message: 'Country is required' })
  @MaxLength(100)
  country: string;

  @ValidateIf((o) => !o.reading_language)
  @IsNotEmpty({ message: 'Reading language is required' })
  @IsString({ message: 'Reading language must be a string' })
  @MaxLength(50, { message: 'Reading language cannot exceed 50 characters' })
  readingLanguage?: string;

  @ValidateIf((o) => o.reading_language !== undefined)
  @IsNotEmpty({ message: 'Reading language is required' })
  @IsString({ message: 'Reading language must be a string' })
  @MaxLength(50, { message: 'Reading language cannot exceed 50 characters' })
  reading_language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'About me cannot exceed 1000 characters' })
  aboutMe?: string;
}
