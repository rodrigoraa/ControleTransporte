import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail) throw new Error('ADMIN_EMAIL deve ser informado.');
  if (!adminPassword) throw new Error('ADMIN_PASSWORD deve ser informado.');

  const user = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { email: true, senha: true, perfil: true, ativo: true },
  });

  if (!user) throw new Error(`Admin ${adminEmail} nao encontrado no banco.`);
  if (!user.ativo) throw new Error(`Admin ${adminEmail} esta inativo.`);
  if (user.perfil !== 'ADMIN') throw new Error(`Admin ${adminEmail} nao possui perfil ADMIN.`);

  const passwordMatches = await bcrypt.compare(adminPassword, user.senha);
  if (!passwordMatches) throw new Error(`Senha do admin ${adminEmail} nao confere com ADMIN_PASSWORD.`);

  console.log(`Admin ${adminEmail} verificado com sucesso.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
