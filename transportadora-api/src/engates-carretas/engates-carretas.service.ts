import { BadRequestException, Injectable } from '@nestjs/common';
import { CrudService } from '../common/crud/crud.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEngateCarretaDto } from './dto/create-engate-carreta.dto';
import { UpdateEngateCarretaDto } from './dto/update-engate-carreta.dto';

@Injectable()
export class EngatesCarretasService extends CrudService<CreateEngateCarretaDto, UpdateEngateCarretaDto> {
  constructor(prisma: PrismaService) {
    super(prisma, 'engateCarreta', ['observacoes'], {
      cavalo: true,
      carreta1: true,
      carreta2: true,
      motorista: true,
    });
  }

  protected normalizeCreate(dto: CreateEngateCarretaDto) {
    this.validateDistinctVehicles(dto);
    return dto;
  }

  protected normalizeUpdate(dto: UpdateEngateCarretaDto) {
    this.validateDistinctVehicles(dto);
    return dto;
  }

  private validateDistinctVehicles(dto: Partial<CreateEngateCarretaDto>) {
    const ids = [dto.cavaloId, dto.carreta1Id, dto.carreta2Id].filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Cavalo e carretas devem ser veiculos diferentes.');
    }
  }
}
