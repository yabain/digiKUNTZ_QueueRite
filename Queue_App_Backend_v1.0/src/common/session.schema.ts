import { Schema } from 'mongoose';
export const SessionSchema = new Schema({userId:Schema.Types.ObjectId,establishmentId:Schema.Types.ObjectId,role:String,tokenHash:String,expiresAt:Date,revokedAt:Date},{timestamps:true});
SessionSchema.index({tokenHash:1},{unique:true});
SessionSchema.index({expiresAt:1},{expireAfterSeconds:0});
