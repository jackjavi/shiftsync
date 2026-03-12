import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { z } from 'zod';

import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { Public } from '../shared/decorators/public.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { AuthenticatedUser } from '../shared/types/shared.types';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type LoginDto = z.infer<typeof loginSchema>;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  async login(@CurrentUser() user: any) {
    return this.authService.login(user);
  }

  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    // Return full user from DB so fields like emailNotificationsEnabled are always fresh
    const fullUser = await this.usersService.findById(user.id);
    return { data: fullUser };
  }
}

