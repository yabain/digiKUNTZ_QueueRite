import {Module,Injectable} from '@nestjs/common'; import {WebSocketGateway,WebSocketServer,OnGatewayConnection} from '@nestjs/websockets'; import {Server,Socket} from 'socket.io'; import {MongooseModule,InjectModel} from '@nestjs/mongoose'; import {Schema,Model} from 'mongoose';
const EventSchema=new Schema({establishmentId:Schema.Types.ObjectId,eventId:String,aggregateId:String,aggregateVersion:Number,eventType:String,payload:Schema.Types.Mixed,occurredAt:Date,publishedAt:Date,attempts:Number},{timestamps:true});
@WebSocketGateway({namespace:'/events',cors:{origin:true,credentials:true}})
export class EventsGateway implements OnGatewayConnection{
 @WebSocketServer() server:Server;
 constructor(@InjectModel('OutboxEvent')private outbox:Model<any>){}
 async handleConnection(client:Socket){
   const token=String(client.handshake.auth?.token||'');
   if(!token){client.disconnect();return;}
   const establishmentId=String(client.handshake.auth?.establishmentId||'');
   if(!establishmentId){client.disconnect();return;}
   client.join(`establishment:${establishmentId}`);
   client.emit('connected',{ok:true});
 }
 emitEvent(establishmentId:string,eventType:string,payload:any){this.server.to(`establishment:${establishmentId}`).emit(eventType,{payload,eventType,occurredAt:new Date()});}
 emitTicketPrinted(establishmentId:string,payload:any){this.emitEvent(establishmentId,'ticket:printed',payload);}
 emitTicketRequestNext(establishmentId:string,payload:any){this.emitEvent(establishmentId,'ticket:request-next',payload);}
 emitCaisseCallNext(establishmentId:string,payload:any){this.emitEvent(establishmentId,'caisse:call-next',payload);}
 emitCaisseStatusUpdated(establishmentId:string,payload:any){this.emitEvent(establishmentId,'caisse:status-updated',payload);}
 emitConfigUpdate(establishmentId:string,payload:any){this.emitEvent(establishmentId,'config:update',payload);}
 emitConfigChanged(establishmentId:string,payload:any){this.emitEvent(establishmentId,'config:changed',payload);}
 async publishPending(){
   const events=await this.outbox.find({publishedAt:null}).sort({createdAt:1}).limit(100);
   for(const e of events){
     this.emitEvent(e.establishmentId.toString(),'domain.event',e);
     e.publishedAt=new Date();e.attempts=(e.attempts||0)+1;await e.save();
   }
 }
}
@Module({imports:[MongooseModule.forFeature([{name:'OutboxEvent',schema:EventSchema}])],providers:[EventsGateway],exports:[EventsGateway]}) export class RealtimeModule{}
