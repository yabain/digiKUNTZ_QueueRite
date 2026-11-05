import {Module,Controller,Post,Get,Param,Body,Req,UseGuards,ConflictException,NotFoundException,BadRequestException,HttpException,HttpStatus} from '@nestjs/common';
import {MongooseModule,InjectModel} from '@nestjs/mongoose'; import {Schema,Model,Types} from 'mongoose'; import {randomUUID,createHash} from 'crypto'; import {SessionGuard} from '../../common/security'; import {SessionSchema} from '../../common/session.schema';
const CounterSchema=new Schema({establishmentId:Schema.Types.ObjectId,queueId:Schema.Types.ObjectId,operationalDate:String,value:{type:Number,default:0}},{timestamps:true}); CounterSchema.index({establishmentId:1,queueId:1,operationalDate:1},{unique:true});
const TicketSchema=new Schema({establishmentId:Schema.Types.ObjectId,queueId:Schema.Types.ObjectId,operationalDate:String,sequenceNumber:Number,displayNumber:String,status:{type:String,default:'waiting'},createdAt:{type:Date,default:Date.now},calledAt:Date,servingAt:Date,completedAt:Date,recalledAt:Date,counterId:Schema.Types.ObjectId,agentId:Schema.Types.ObjectId,version:{type:Number,default:1},source:String},{timestamps:true,versionKey:false}); TicketSchema.index({establishmentId:1,queueId:1,operationalDate:1,sequenceNumber:1},{unique:true}); TicketSchema.index({establishmentId:1,queueId:1,status:1,createdAt:1,_id:1}); TicketSchema.index({establishmentId:1,operationalDate:1,status:1});
const IdemSchema=new Schema({establishmentId:Schema.Types.ObjectId,key:String,payloadHash:String,response:Schema.Types.Mixed,createdAt:{type:Date,default:Date.now}},{versionKey:false}); IdemSchema.index({establishmentId:1,key:1},{unique:true});
const EventSchema=new Schema({establishmentId:Schema.Types.ObjectId,ticketId:Schema.Types.ObjectId,type:String,fromStatus:String,toStatus:String,actorId:Schema.Types.ObjectId,counterId:Schema.Types.ObjectId,occurredAt:{type:Date,default:Date.now}},{versionKey:false});
const OutboxSchema=new Schema({establishmentId:Schema.Types.ObjectId,eventId:String,aggregateId:String,aggregateVersion:Number,eventType:String,payload:Schema.Types.Mixed,occurredAt:Date,publishedAt:Date,attempts:{type:Number,default:0}},{timestamps:true}); OutboxSchema.index({publishedAt:1,createdAt:1});

@Controller('tickets') @UseGuards(SessionGuard)
class TicketsController{
 constructor(@InjectModel('Ticket')private tickets:Model<any>,@InjectModel('QueueCounter')private counters:Model<any>,@InjectModel('IdempotencyRecord')private idem:Model<any>,@InjectModel('TicketEvent')private events:Model<any>,@InjectModel('OutboxEvent')private outbox:Model<any>,@InjectModel('Queue')private queues:Model<any>){}
 private day(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Douala',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
 @Post() async create(@Req() req:any,@Body() b:any){if(!Types.ObjectId.isValid(b.queueId))throw new BadRequestException('queueId invalid');const key=String(req.headers['idempotency-key']||b.idempotencyKey||'');if(!key)throw new BadRequestException('Idempotency-Key required');const payloadHash=createHash('sha256').update(JSON.stringify({queueId:b.queueId,source:b.source||'kiosk'})).digest('hex');const prior=await this.idem.findOne({establishmentId:req.user.establishmentId,key});if(prior){if(prior.payloadHash!==payloadHash)throw new ConflictException('Idempotency key reused with different payload');return prior.response;}
 const q=await this.queues.findOne({_id:b.queueId,establishmentId:req.user.establishmentId,active:true});if(!q)throw new NotFoundException('Queue not found');const date=this.day();const session=await this.tickets.db.startSession();let result:any;try{await session.withTransaction(async()=>{const c=await this.counters.findOneAndUpdate({establishmentId:req.user.establishmentId,queueId:q._id,operationalDate:date},{$inc:{value:1}},{upsert:true,new:true,session});const n=c.value;const ticket=await this.tickets.create([{establishmentId:req.user.establishmentId,queueId:q._id,operationalDate:date,sequenceNumber:n,displayNumber:`${q.prefix||''}${String(n).padStart(3,'0')}`,status:'waiting',source:b.source||'kiosk'}],{session});result=ticket[0].toObject();await this.events.create([{establishmentId:req.user.establishmentId,ticketId:result._id,type:'created',toStatus:'waiting',actorId:req.user.id}],{session});await this.outbox.create([{establishmentId:req.user.establishmentId,eventId:randomUUID(),aggregateId:String(result._id),aggregateVersion:1,eventType:'ticket.created',payload:{ticketId:String(result._id),displayNumber:result.displayNumber,queueId:String(q._id)},occurredAt:new Date()}],{session});await this.idem.create([{establishmentId:req.user.establishmentId,key,payloadHash,response:result}],{session});});}finally{await session.endSession();}return result;}
 @Get() async list(@Req() req:any){return this.tickets.find({establishmentId:req.user.establishmentId}).sort({createdAt:-1}).limit(300).lean();}
 @Get('waiting/:queueId') async waiting(@Req() req:any,@Param('queueId') queueId:string){return this.tickets.find({establishmentId:req.user.establishmentId,queueId,status:'waiting'}).sort({createdAt:1,_id:1}).limit(100).lean();}
 @Post('call-next') async callNext(@Req() req:any,@Body() b:any){if(!b.queueId||!b.counterId)throw new BadRequestException('queueId and counterId required');const t=await this.tickets.findOneAndUpdate({establishmentId:req.user.establishmentId,queueId:b.queueId,status:'waiting'},{$set:{status:'called',counterId:b.counterId,agentId:req.user.id,calledAt:new Date()},$inc:{version:1}},{sort:{createdAt:1,_id:1},new:true});if(!t)throw new NotFoundException('No waiting ticket');await this.events.create({establishmentId:req.user.establishmentId,ticketId:t._id,type:'called',fromStatus:'waiting',toStatus:'called',actorId:req.user.id,counterId:b.counterId});await this.outbox.create({establishmentId:req.user.establishmentId,eventId:randomUUID(),aggregateId:String(t._id),aggregateVersion:t.version,eventType:'ticket.called',payload:{ticketId:String(t._id),displayNumber:t.displayNumber,counterId:b.counterId},occurredAt:new Date()});return t;}
 @Post(':id/serve') async serve(@Req() req:any,@Param('id') id:string){return this.transition(req,id,'called','serving',{servingAt:new Date()});}
 @Post(':id/complete') async complete(@Req() req:any,@Param('id') id:string){return this.transition(req,id,'serving','completed',{completedAt:new Date()});}
 @Post(':id/skip') async skip(@Req() req:any,@Param('id') id:string){const t=await this.tickets.findOne({establishmentId:req.user.establishmentId,_id:id,status:{$in:['called','waiting']}});if(!t)throw new NotFoundException();return this.transition(req,id,t.status,'skipped',{});}
 @Post(':id/recall') async recall(@Req() req:any,@Param('id') id:string){const t=await this.tickets.findOneAndUpdate({establishmentId:req.user.establishmentId,_id:id,status:'called'},{$set:{recalledAt:new Date()},$inc:{version:1}},{new:true});if(!t)throw new NotFoundException();await this.outbox.create({establishmentId:req.user.establishmentId,eventId:randomUUID(),aggregateId:id,aggregateVersion:t.version,eventType:'ticket.recalled',payload:{ticketId:id,displayNumber:t.displayNumber,counterId:String(t.counterId)},occurredAt:new Date()});return t;}
 private async transition(req:any,id:string,from:string,to:string,extra:any){const t=await this.tickets.findOneAndUpdate({establishmentId:req.user.establishmentId,_id:id,status:from},{$set:{status:to,...extra},$inc:{version:1}},{new:true});if(!t)throw new ConflictException(`Invalid transition; expected ${from}`);await this.events.create({establishmentId:req.user.establishmentId,ticketId:id,type:to,fromStatus:from,toStatus:to,actorId:req.user.id,counterId:t.counterId});await this.outbox.create({establishmentId:req.user.establishmentId,eventId:randomUUID(),aggregateId:id,aggregateVersion:t.version,eventType:`ticket.${to}`,payload:{ticketId:id,displayNumber:t.displayNumber,status:to,counterId:t.counterId},occurredAt:new Date()});return t;}
}
import {DomainModule} from '../domain/domain.module';
import {TicketCronService} from './ticket-cron.service';

/**
 * Public, unauthenticated ticket generation for POS/kiosk screens.
 * The queue comes from the URL and the establishment from the queue itself,
 * so no session is required. A light per-IP throttle protects the endpoint.
 */
@Controller('public/file')
class PublicTicketsController{
 private readonly hits=new Map<string,{count:number;reset:number}>();
 constructor(@InjectModel('Ticket')private tickets:Model<any>,@InjectModel('QueueCounter')private counters:Model<any>,@InjectModel('IdempotencyRecord')private idem:Model<any>,@InjectModel('TicketEvent')private events:Model<any>,@InjectModel('OutboxEvent')private outbox:Model<any>,@InjectModel('Queue')private queues:Model<any>){}
 private day(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Douala',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
 private throttle(ip:string){const now=Date.now();const entry=this.hits.get(ip);if(!entry||entry.reset<now){if(this.hits.size>5000)this.hits.clear();this.hits.set(ip,{count:1,reset:now+60000});return;}entry.count++;if(entry.count>120)throw new HttpException('Too many ticket requests',HttpStatus.TOO_MANY_REQUESTS);}
 @Post(':id/tickets') async create(@Param('id') id:string,@Body() b:any,@Req() req:any){
   this.throttle(String(req.ip||req.socket?.remoteAddress||'unknown'));
   if(!Types.ObjectId.isValid(id))throw new NotFoundException('Queue not found');
   const q:any=await this.queues.findOne({_id:id,active:true}).lean();
   if(!q)throw new NotFoundException('Queue not found');
   const establishmentId=q.establishmentId;
   const source='kiosk';
   const key=String(req.headers['idempotency-key']||b?.idempotencyKey||'');
   const payloadHash=createHash('sha256').update(JSON.stringify({queueId:id,source})).digest('hex');
   if(key){const prior:any=await this.idem.findOne({establishmentId,key}).lean();if(prior){if(prior.payloadHash!==payloadHash)throw new ConflictException('Idempotency key reused with different payload');return prior.response;}}
   const date=this.day();
   const session=await (this.tickets.db as any).startSession();
   let result:any;
   try{
     await session.withTransaction(async()=>{
       const c=await this.counters.findOneAndUpdate({establishmentId,queueId:q._id,operationalDate:date},{$inc:{value:1}},{upsert:true,new:true,session});
       const created=await this.tickets.create([{establishmentId,queueId:q._id,operationalDate:date,sequenceNumber:c.value,displayNumber:`${q.prefix||''}${String(c.value).padStart(3,'0')}`,status:'waiting',source}],{session});
       result=created[0].toObject();
       await this.events.create([{establishmentId,ticketId:result._id,type:'created',toStatus:'waiting'}],{session});
       await this.outbox.create([{establishmentId,eventId:randomUUID(),aggregateId:String(result._id),aggregateVersion:1,eventType:'ticket.created',payload:{ticketId:String(result._id),displayNumber:result.displayNumber,queueId:String(q._id)},occurredAt:new Date()}],{session});
       if(key)await this.idem.create([{establishmentId,key,payloadHash,response:result}],{session});
     });
   }finally{await session.endSession();}
   return result;
 }
}

@Module({imports:[DomainModule,MongooseModule.forFeature([{name:'Ticket',schema:TicketSchema},{name:'QueueCounter',schema:CounterSchema},{name:'IdempotencyRecord',schema:IdemSchema},{name:'TicketEvent',schema:EventSchema},{name:'OutboxEvent',schema:OutboxSchema},{name:'Session',schema:SessionSchema}])],controllers:[TicketsController,PublicTicketsController],providers:[TicketCronService,SessionGuard],exports:[MongooseModule]}) export class TicketsModule{}
