import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RelatorioFinanceiroQueryDto } from './relatorio-financeiro-query.dto';

describe('RelatorioFinanceiroQueryDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const transform = (value: Record<string, unknown>) => pipe.transform(value, { type: 'query', metatype: RelatorioFinanceiroQueryDto });

  it.each(['REGISTRO_GERAL', 'RELATORIO_COMBINADO', 'MEDIA_FROTA', 'ULTIMAS_MEDIAS_FROTA'])(
    'aceita o tipo %s sem remover os tipos existentes', async (tipoRelatorio) => {
      await expect(transform({ tipoRelatorio })).resolves.toMatchObject({ tipoRelatorio });
    },
  );

  it('aceita e normaliza os filtros da nova opção e os parâmetros de exportação', async () => {
    const query = await transform({
      tipoRelatorio: 'ULTIMAS_MEDIAS_FROTA', cavaloMecanicoId: 'cav-1', cavaloMecanicoIds: 'cav-1,cav-2',
      placa: 'qav-0d73', secoes: 'ultimas_medias', colunas: 'ultimas_medias:placa,ultimas_medias:media',
    });
    expect(query).toBeInstanceOf(RelatorioFinanceiroQueryDto);
    expect(query).toMatchObject({ tipoRelatorio: 'ULTIMAS_MEDIAS_FROTA', placa: 'QAV0D73', cavaloMecanicoId: 'cav-1' });
  });

  it('rejeita tipos desconhecidos e parâmetros não declarados', async () => {
    await expect(transform({ tipoRelatorio: 'ULTIMA_MEDIA_INVALIDA' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(transform({ tipoRelatorio: 'ULTIMAS_MEDIAS_FROTA', campoDesconhecido: 'valor' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
