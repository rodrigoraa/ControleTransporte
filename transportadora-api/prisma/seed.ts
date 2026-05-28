import 'dotenv/config';
import { PerfilUsuario, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'Administrador';

  if (!adminEmail) throw new Error('ADMIN_EMAIL deve ser informado para executar o seed.');
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error('ADMIN_PASSWORD deve ser informado e ter pelo menos 12 caracteres.');
  }

  await prisma.user.upsert({
    where: {
      email: adminEmail,
    },
    update: {},
    create: {
      nome: adminName,
      email: adminEmail,
      senha: await bcrypt.hash(adminPassword, 10),
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
