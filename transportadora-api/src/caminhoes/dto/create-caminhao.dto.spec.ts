import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { CreateImplementoDto } from '../../implementos/dto/create-implemento.dto';
import { CreateLancamentoFinanceiroDto } from '../../lancamentos-financeiros/dto/create-lancamento-financeiro.dto';
import { RelatorioFinanceiroQueryDto } from '../../relatorios/dto/relatorio-financeiro-query.dto';
import { CreateCaminhaoDto } from './create-caminhao.dto';

describe('limite de placas', () => {
  const placa = `abc-${'1'.repeat(130)}`;
  const cases: Array<[string, () => { placa?: string | null }]> = [
    ['cavalo mecânico', () => plainToInstance(CreateCaminhaoDto, { placa })],
    ['implemento', () => plainToInstance(CreateImplementoDto, { placa })],
    ['lançamento financeiro', () => plainToInstance(CreateLancamentoFinanceiroDto, { placa })],
    ['filtro de relatório', () => plainToInstance(RelatorioFinanceiroQueryDto, { placa })],
  ];

  it.each(cases)(
    'normaliza e limita a placa de %s a 128 caracteres',
    (_name, createDto) => {
      const dto = createDto();

      expect(dto.placa).toHaveLength(128);
      expect(dto.placa).toMatch(/^[A-Z0-9]+$/);
      expect(dto.placa?.startsWith('ABC')).toBe(true);
    },
  );
});
