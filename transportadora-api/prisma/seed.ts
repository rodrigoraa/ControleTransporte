import 'dotenv/config';
import { PerfilUsuario, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME?.trim() || 'Administrador';

  if (!adminEmail) throw new Error('ADMIN_EMAIL deve ser informado para executar o seed.');
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error('ADMIN_PASSWORD deve ser informado e ter pelo menos 12 caracteres.');
  }
  const bcryptRounds = Number(process.env.BCRYPT_ROUNDS || 12);
  if (!Number.isInteger(bcryptRounds) || bcryptRounds < 10 || bcryptRounds > 15) {
    throw new Error('BCRYPT_ROUNDS deve ser um numero inteiro entre 10 e 15.');
  }

  await prisma.user.upsert({
    where: {
      email: adminEmail,
    },
    update: {
      nome: adminName,
      senha: await bcrypt.hash(adminPassword, bcryptRounds),
      perfil: PerfilUsuario.ADMIN,
      ativo: true,
    },
    create: {
      nome: adminName,
      email: adminEmail,
      senha: await bcrypt.hash(adminPassword, bcryptRounds),
      perfil: PerfilUsuario.ADMIN,
      ativo: true,
    },
  });

  console.log('Usuario administrador sincronizado.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
