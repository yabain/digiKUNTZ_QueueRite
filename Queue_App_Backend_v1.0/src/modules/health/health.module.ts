import {Module,Controller,Get} from '@nestjs/common';import {InjectConnection} from '@nestjs/mongoose';import {Connection} from 'mongoose';
@Controller('health') class HealthController{constructor(@InjectConnection()private db:Connection){}@Get() health(){return {status:this.db.readyState===1?'ok':'degraded',database:this.db.readyState,service:'queue-app-api',time:new Date().toISOString()};}}
@Module({controllers:[HealthController]}) export class HealthModule{}
