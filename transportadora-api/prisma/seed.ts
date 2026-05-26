import 'dotenv/config';
import { PerfilUsuario, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: {
      email: 'admin@transportadora.com',
    },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@transportadora.com',
      senha: await bcrypt.hash('admin123', 10),
      perfil: PerfilUsuario.ADMIN,
    },
  });

  console.log('Usuario administrador criado.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });