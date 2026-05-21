import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationDto } from '../common/crud/pagination.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private safe(user: any) {
    const { senha, ...rest } = user;
    return rest;
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email ja cadastrado');
    const user = await this.prisma.user.create({
      data: { ...dto, senha: await bcrypt.hash(dto.senha, 10) },
    });
    return this.safe(user);
  }

  async findAll(query: PaginationDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where = query.search
      ? { OR: [{ nome: { contains: query.search, mode: 'insensitive' as const } }, { email: { contains: query.search, mode: 'insensitive' as const } }] }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { nome: 'asc' } }),
      this.prisma.user.count({ where }),
    ]);
    return { data: data.map((user) => this.safe(user)), total, page, limit };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario nao encontrado');
    return this.safe(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const data = { ...dto } as any;
    if (dto.senha) data.senha = await bcrypt.hash(dto.senha, 10);
    const user = await this.prisma.user.update({ where: { id }, data });
    return this.safe(user);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Usuario excluido com sucesso' };
  }
}
