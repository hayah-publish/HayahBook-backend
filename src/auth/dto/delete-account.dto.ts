import { Matches } from 'class-validator';

export class DeleteAccountDto {
  @Matches(/^\d{6}$/, { message: 'Code must be exactly 6 digits' })
  code: string;
}

