import { Schema, model } from 'mongoose';

/**
 * Caisse schema for managing caisse configuration.
 * Each caisse belongs to a Queue (file) and is scoped to an establishment.
 * Model name: 'Caisse' (collection: 'caisses')
 */
const caisseSchema = new Schema(
  {
    establishmentId: { type: Schema.Types.ObjectId, required: true },
    queueId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, maxlength: 120 },
    username: { type: String, required: true, maxlength: 80 },
    password: { type: String, required: true, minlength: 4 },
    active: { type: Boolean, default: true },
    pausedByCashier: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Multi-tenant isolation + fast lookups + username uniqueness per establishment+queue
caisseSchema.index({ establishmentId: 1, queueId: 1 });
caisseSchema.index({ queueId: 1 });
caisseSchema.index({ username: 1, establishmentId: 1 }, { unique: true });

export const Caisse = model('Caisse', caisseSchema);