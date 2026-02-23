import { Controller, Get, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot(): { message: string; docs: string } {
    return {
      message: 'School Management System API',
      docs: '/api/docs',
    };
  }

  @Get('health')
  getHealth(): { status: string } {
    return this.appService.getHealth();
  }

  /** Browser/PWA often request these against the API origin; respond without 404 to avoid error logs. */
  @Get('favicon.ico')
  @HttpCode(HttpStatus.NO_CONTENT)
  favicon(@Res() res: Response): void {
    res.status(HttpStatus.NO_CONTENT).send();
  }

  @Get('sw.js')
  @HttpCode(HttpStatus.NO_CONTENT)
  sw(@Res() res: Response): void {
    res.status(HttpStatus.NO_CONTENT).send();
  }
}

