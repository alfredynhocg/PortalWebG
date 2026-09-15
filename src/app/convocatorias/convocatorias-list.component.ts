import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ConvocatoriasService } from './convocatorias.service';
import { Convocatoria } from './convocatoria.model';

@Component({
  selector: 'app-convocatorias-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './convocatorias-list.component.html',
  styleUrl: './convocatorias-list.component.css',
})
export class ConvocatoriasListComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly convocatorias = signal<Convocatoria[]>([]);
  readonly totalRegistros = signal(0);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  buscar = '';
  area = '';
  tipoContrato = '';
  ubicacion = '';
  pestana: 'todos' | 'vigentes' = 'vigentes';

  page = 1;
  perPage = 10;

  constructor(private convocatoriasService: ConvocatoriasService) {}

  ngOnInit(): void {
    this.convocatoriasService.stream().subscribe((resultado) => {
      if (resultado.ok) {
        this.convocatorias.set(resultado.respuesta.data);
        this.totalRegistros.set(resultado.respuesta.totalRegistros);
        this.error.set(null);
      } else {
        this.error.set(
          resultado.status === 401
            ? 'Token de demo vencido o inválido. Genera uno nuevo (ver demo-config.ts).'
            : 'No se pudo cargar el listado de convocatorias.'
        );
      }
      this.cargando.set(false);
    });

    this.cargar();
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.totalRegistros() / this.perPage));
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.convocatoriasService.actualizarFiltros({
      buscar: this.buscar,
      area: this.area,
      tipo_contrato: this.tipoContrato,
      ubicacion: this.ubicacion,
      page: this.page,
      per_page: this.perPage,
    });
  }

  buscarClick(): void {
    this.page = 1;
    this.cargar();
  }

  anteriorPagina(): void {
    if (this.page > 1) {
      this.page--;
      this.cargar();
    }
  }

  siguientePagina(): void {
    if (this.page < this.totalPaginas) {
      this.page++;
      this.cargar();
    }
  }

  verDetalle(codigo: string): void {
    this.router.navigate(['/convocatorias/detalle'], { queryParams: { codigo } });
  }

  etiquetaTipoConvocatoria(convocatoria: Convocatoria): string {
    return convocatoria.tipo_convocatoria === 'INTERNA' ? 'Interna' : 'Externo';
  }

  tituloCase(texto: string | null | undefined): string {
    if (!texto) {
      return '';
    }
    return texto
      .toLowerCase()
      .split(' ')
      .map((palabra) => (palabra ? palabra[0].toUpperCase() + palabra.slice(1) : palabra))
      .join(' ');
  }

  fechaCorta(fechaIso: string | null | undefined): string {
    if (!fechaIso) {
      return '';
    }
    const [anio, mes, dia] = fechaIso.split('-');
    return `${dia}/${mes}/${anio}`;
  }
}
