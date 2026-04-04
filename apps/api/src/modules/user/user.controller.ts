import { Controller, Get, Patch, Body, Req, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './user.service';
import type { Request } from 'express';

@Controller('user')
@UseGuards(AuthGuard('jwt'))
export class UserController {
  constructor(private userService: UserService) {}

  @Get('profile')
  getProfile(@Req() req: Request) {
    return this.userService.getProfile((req as any).user.userId);
  }

  @Patch('profile')
  updateProfile(@Req() req: Request, @Body() body: { nickname?: string }) {
    return this.userService.updateProfile((req as any).user.userId, body);
  }

  @Get('stats')
  getStats(@Req() req: Request) {
    return this.userService.getStats((req as any).user.userId);
  }

  @Get('words')
  getWordHistory(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.userService.getWordHistory(
      (req as any).user.userId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}
