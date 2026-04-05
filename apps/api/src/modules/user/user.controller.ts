import { Controller, Get, Patch, Body, Req, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserService } from './user.service';
import type { AuthenticatedRequest } from '../../common/types';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get('profile')
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.userService.getProfile(req.user.userId);
  }

  @Patch('profile')
  updateProfile(@Req() req: AuthenticatedRequest, @Body() body: { nickname?: string }) {
    return this.userService.updateProfile(req.user.userId, body);
  }

  @Get('stats')
  getStats(@Req() req: AuthenticatedRequest) {
    return this.userService.getStats(req.user.userId);
  }

  @Get('words')
  getWordHistory(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.userService.getWordHistory(
      req.user.userId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}
