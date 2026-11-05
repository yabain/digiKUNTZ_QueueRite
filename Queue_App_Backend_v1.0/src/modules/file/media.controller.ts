import {
  BadRequestException,
  Controller,
  Delete,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { join, resolve } from 'path';
import { SessionGuard, RolesGuard, Roles } from '../../common/security';

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv'
};

/**
 * Derive the real media type from the file bytes instead of trusting the
 * client-supplied multipart Content-Type (which is trivial to spoof).
 */
function sniffMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return 'video/mp4';
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'video/webm';
  }
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS') {
    return 'video/ogg';
  }
  return null;
}

@Controller('media')
@UseGuards(SessionGuard)
export class MediaController {
  constructor(@InjectModel('MediaAsset') private readonly media: Model<any>) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 },
      fileFilter: (_req: any, file: any, callback: any) => {
        if (!ALLOWED[file.mimetype]) {
          return callback(new BadRequestException('Type de fichier non supporté'), false);
        }
        callback(null, true);
      }
    })
  )
  async upload(@UploadedFile() file: any, @Req() req: any) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');

    const mimeType = sniffMime(file.buffer);
    const extension = mimeType ? ALLOWED[mimeType] : undefined;
    if (!mimeType || !extension) {
      throw new BadRequestException('Contenu de fichier non reconnu');
    }

    const mediaRoot = resolve(process.env.MEDIA_ROOT || './media');
    await mkdir(mediaRoot, { recursive: true });

    const storageName = `${randomUUID()}.${extension}`;
    await writeFile(join(mediaRoot, storageName), file.buffer);

    const displayName = String(file.originalname || 'media')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .slice(0, 200);

    const asset = await this.media.create({
      establishmentId: req.user.establishmentId,
      name: displayName,
      storageName,
      mimeType,
      size: file.size,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
      status: 'ready',
      uploadedBy: req.user.id
    });

    return {
      id: String(asset._id),
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size,
      type: mimeType.startsWith('image/') ? 'image' : 'video',
      url: `/api/public/media/${asset._id}`
    };
  }

  @Delete(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('super_admin', 'admin', 'supervisor', 'technician')
  async removeMedia(@Param('id') id: string, @Req() req: any) {
    const asset = await this.media.findOne({ _id: id, establishmentId: req.user.establishmentId });
    if (!asset) throw new BadRequestException('Média non trouvé');
    try {
      const mediaRoot = resolve(process.env.MEDIA_ROOT || './media');
      const filePath = join(mediaRoot, String(asset.storageName));
      await unlink(filePath);
    } catch {
      // Fichier déjà supprimé physiquement — continuer
    }
    await this.media.deleteOne({ _id: id, establishmentId: req.user.establishmentId });
    return { deleted: true };
  }
}
