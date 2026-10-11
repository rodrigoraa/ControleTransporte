import { BadRequestException, Controller, PayloadTooLargeException, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PerfilUsuario } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { AuditActor } from '../common/audit/audit-context';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DEFAULT_IMPORT_MAX_FILE_BYTES, IMPORT_MAX_OPTIONS_BYTES } from './importacao.constants';
import { ImportacoesService } from './importacoes.service';
import { ArquivoImportacao } from './planilha-lancamentos.parser';

@Controller('importacoes/lancamentos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.ADMIN)
export class ImportacoesController {
  constructor(private readonly service: ImportacoesService, private readonly config: ConfigService) {}

  @Post('preview')
  async preview(@Req() request: FastifyRequest, @CurrentUser() actor: AuditActor) {
    const { arquivo, opcoes } = await this.readUpload(request);
    return this.service.preview(arquivo, opcoes, actor);
  }

  @Post('confirmar')
  async confirmar(@Req() request: FastifyRequest, @CurrentUser() actor: AuditActor) {
    const { arquivo, opcoes } = await this.readUpload(request);
    return this.service.confirmar(arquivo, opcoes, actor);
  }

  private async readUpload(request: FastifyRequest) {
    if (!request.isMultipart()) throw new BadRequestException('Envie a planilha no formato multipart/form-data.');
    const maxBytes = this.config.get<number>('IMPORT_MAX_FILE_BYTES') ?? DEFAULT_IMPORT_MAX_FILE_BYTES;
    let arquivo: ArquivoImportacao | undefined;
    let opcoes: Record<string, unknown> = {};
    let recebeuOpcoes = false;
    try {
      for await (const part of request.parts({
        limits: { files: 1, fields: 1, parts: 2, fileSize: maxBytes, fieldSize: IMPORT_MAX_OPTIONS_BYTES },
      })) {
        if (part.type === 'file') {
          if (part.fieldname !== 'arquivo' || arquivo) {
            part.file.resume();
            throw new BadRequestException('Envie apenas uma planilha no campo arquivo.');
          }
          const buffer = await part.toBuffer();
          if (part.file.truncated) throw new PayloadTooLargeException('A planilha excede o tamanho máximo permitido.');
          arquivo = { nome: part.filename, mimeType: part.mimetype, buffer };
        } else {
          if (part.fieldname !== 'opcoes' || recebeuOpcoes) throw new BadRequestException('Campo de upload inválido. Use arquivo e opcoes.');
          if (part.valueTruncated || typeof part.value !== 'string' || Buffer.byteLength(part.value) > IMPORT_MAX_OPTIONS_BYTES) {
            throw new PayloadTooLargeException('As opções de importação excedem o tamanho máximo permitido.');
          }
          recebeuOpcoes = true;
          try { opcoes = JSON.parse(part.value); }
          catch { throw new BadRequestException('As opções de importação devem ser um JSON válido.'); }
          if (!opcoes || typeof opcoes !== 'object' || Array.isArray(opcoes)) throw new BadRequestException('As opções de importação devem ser um objeto JSON.');
        }
      }
    } catch (error: any) {
      if (error?.code === 'FST_REQ_FILE_TOO_LARGE') throw new PayloadTooLargeException('A planilha excede o tamanho máximo permitido.');
      if (['FST_FILES_LIMIT', 'FST_FIELDS_LIMIT', 'FST_PARTS_LIMIT'].includes(error?.code)) {
        throw new BadRequestException('Envie apenas uma planilha e um campo de opções.');
      }
      if (error instanceof BadRequestException || error instanceof PayloadTooLargeException) throw error;
      throw new BadRequestException('Não foi possível receber o arquivo. Verifique o envio multipart.');
    }
    if (!arquivo?.buffer.length) throw new BadRequestException('Selecione uma planilha não vazia.');
    return { arquivo, opcoes };
  }
}
