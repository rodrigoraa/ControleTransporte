import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AbastecimentosQueryDto } from './abastecimentos-query.dto';

describe('AbastecimentosQueryDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const transform = (value: Record<string, unknown>) => pipe.transform(value, { type: 'query', metatype: AbastecimentosQueryDto });

  it('aceita os filtros enviados pela tabela e converte números, incluindo zero e decimais', async () => {
    const query = await transform({
      page: '2',
      limit: '10',
      search: 'QAV0D73',
      data: '2026-09-28',
      cavalo: 'QAV0D73',
      kmAnterior: '0',
      kmAtual: '567101.1',
      distanciaPercorrida: '744',
      litros: '774.001',
      mediaKmLitro: '1.913',
    });

    expect(query).toBeInstanceOf(AbastecimentosQueryDto);
    expect(query).toMatchObject({
      page: 2,
      limit: 10,
      kmAnterior: 0,
      kmAtual: 567101.1,
      distanciaPercorrida: 744,
      litros: 774.001,
      mediaKmLitro: 1.913,
    });
  });

  it.each(['kmAnterior', 'kmAtual', 'distanciaPercorrida', 'litros', 'mediaKmLitro'])(
    'rejeita número inválido e negativo no filtro %s', async (field) => {
      await expect(transform({ [field]: 'texto' })).rejects.toBeInstanceOf(BadRequestException);
      await expect(transform({ [field]: '-1' })).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('preserva a consulta de histórico por cavalo e rejeita parâmetros desconhecidos', async () => {
    await expect(transform({ cavaloMecanicoId: 'cav-1' })).resolves.toMatchObject({ cavaloMecanicoId: 'cav-1' });
    await expect(transform({ campoInexistente: 'teste' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
