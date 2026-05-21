import { Controller } from '@nestjs/common';
import { CrudController } from '../common/crud/crud.controller';
import { CreateEngateCarretaDto } from './dto/create-engate-carreta.dto';
import { UpdateEngateCarretaDto } from './dto/update-engate-carreta.dto';
import { EngatesCarretasService } from './engates-carretas.service';

@Controller('engates-carretas')
export class EngatesCarretasController extends CrudController<CreateEngateCarretaDto, UpdateEngateCarretaDto> {
  constructor(service: EngatesCarretasService) {
    super(service);
  }
}
