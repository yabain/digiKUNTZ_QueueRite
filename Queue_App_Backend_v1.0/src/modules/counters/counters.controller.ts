import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { CountersService } from './counters.service';
import { CaisseDto, UpdateCaisseDto } from './counters.dto';
import { SessionGuard, RolesGuard, Roles } from '../../common/security';

@Controller('counters')
@UseGuards(SessionGuard, RolesGuard)
export class CountersController {
  constructor(private readonly countersService: CountersService) {}

  @Get()
  async listCounters(@Req() req: any, @Query('queueId') queueId?: string) {
    return this.countersService.listCaises(req.user.establishmentId, queueId);
  }

  @Get('me')
  async getMyCounter(@Req() req: any) {
    return this.countersService.getMyCaisse(req.user.establishmentId, req.user.id);
  }

  @Get('me/current-ticket')
  async getMyCurrentTicket(@Req() req: any) {
    return this.countersService.getCurrentTicket(req.user.id, req.user.establishmentId);
  }

  @Post('me/online')
  async setOnline(@Req() req: any) {
    return this.countersService.setOnline(req.user.id, req.user.establishmentId, true);
  }

  @Post('me/offline')
  async setOffline(@Req() req: any) {
    return this.countersService.setOnline(req.user.id, req.user.establishmentId, false);
  }

  @Post('me/pause')
  async setPause(@Req() req: any, @Body() dto: any) {
    return this.countersService.setPause(req.user.id, req.user.establishmentId, dto?.paused === true);
  }

  @Get(':id')
  async getCounter(@Param('id') id: string, @Req() req: any) {
    return this.countersService.getCaisse(id, req.user.establishmentId);
  }

  @Post()
  @Roles('super_admin', 'admin', 'supervisor', 'technician')
  async createCounter(@Req() req: any, @Body() dto: CaisseDto) {
    return this.countersService.createCaisse(req.user.establishmentId, dto);
  }

  @Patch(':id')
  @Roles('super_admin', 'admin', 'supervisor', 'technician')
  async updateCounter(
    @Param('id') id: string,
    @Body() dto: UpdateCaisseDto,
    @Req() req: any,
  ) {
    return this.countersService.updateCaisse(id, req.user.establishmentId, dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin', 'supervisor', 'technician')
  async removeCounter(@Param('id') id: string, @Req() req: any) {
    return this.countersService.removeCaisse(id, req.user.establishmentId);
  }
}