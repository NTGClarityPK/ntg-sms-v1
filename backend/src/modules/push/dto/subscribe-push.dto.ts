import { IsString, IsObject } from 'class-validator';

export class SubscribePushDto {
  @IsString()
  endpoint!: string;

  @IsObject()
  keys!: {
    p256dh: string;
    auth: string;
  };
}
