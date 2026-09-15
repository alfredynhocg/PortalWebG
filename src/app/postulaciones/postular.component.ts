import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PostulacionesService } from './postulaciones.service';
import { DatosPersonalesPostulante } from './postulacion.model';

// Paso 1 de 6 del wizard de postulación (Datos personales). Los pasos 2-6
// (Formación Académica, Experiencia Laboral, Conocimientos y Habilidades,
// Documentos, Confirmar) quedan pendientes para una siguiente entrega — ver
// formulario_postulante.json en el repo del backend para su diseño completo.
@Component({
  selector: 'app-postular',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './postular.component.html',
  styleUrl: './postular.component.css',
})
export class PostularComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly postulacionesService = inject(PostulacionesService);

  codigo = '';
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly postulacionExistenteId = signal<number | null>(null);

  datos: DatosPersonalesPostulante = {
    ci: '',
    tipo_documento: 'CI',
    complemento: '',
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    apellido_casada: '',
    utilizar_apellido_casada: 'NO',
    fecha_nacimiento: '',
    expedido: '',
    estado_civil: '',
    genero: '',
    lugar_nacimiento: '',
    departamento: '',
    localidad: '',
    direccion_domicilio: '',
    telefono_domicilio: '',
    celular: '',
    email: '',
    nro_libreta_militar: '',
    grupo_sanguineo: '',
    contacto_emergencia: '',
    foto_perfil_url: '',
    cedula_identidad_doc_url: '',
    libreta_militar_doc_url: '',
  };

  readonly departamentos = [
    { valor: 'LA_PAZ', etiqueta: 'LA PAZ' },
    { valor: 'COCHABAMBA', etiqueta: 'COCHABAMBA' },
    { valor: 'SANTA_CRUZ', etiqueta: 'SANTA CRUZ' },
    { valor: 'ORURO', etiqueta: 'ORURO' },
    { valor: 'POTOSI', etiqueta: 'POTOSÍ' },
    { valor: 'CHUQUISACA', etiqueta: 'CHUQUISACA' },
    { valor: 'TARIJA', etiqueta: 'TARIJA' },
    { valor: 'BENI', etiqueta: 'BENI' },
    { valor: 'PANDO', etiqueta: 'PANDO' },
  ];

  readonly expedidos = [
    { valor: 'LP', etiqueta: 'LA PAZ' },
    { valor: 'CB', etiqueta: 'COCHABAMBA' },
    { valor: 'SC', etiqueta: 'SANTA CRUZ' },
    { valor: 'OR', etiqueta: 'ORURO' },
    { valor: 'PT', etiqueta: 'POTOSÍ' },
    { valor: 'CH', etiqueta: 'CHUQUISACA' },
    { valor: 'TJ', etiqueta: 'TARIJA' },
    { valor: 'BE', etiqueta: 'BENI' },
    { valor: 'PA', etiqueta: 'PANDO' },
  ];

  readonly estadosCiviles = ['SOLTERO', 'CASADO', 'DIVORCIADO', 'VIUDO', 'CONCUBINO'];

  ngOnInit(): void {
    const codigo = this.route.snapshot.queryParamMap.get('codigo');
    if (!codigo) {
      this.router.navigateByUrl('/');
      return;
    }
    this.codigo = codigo;
  }

  enviar(formulario: NgForm): void {
    if (formulario.invalid) {
      formulario.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);
    this.postulacionExistenteId.set(null);

    this.postulacionesService.postular(this.codigo, this.datos).subscribe({
      next: (respuesta) => {
        this.enviando.set(false);
        this.irAlSiguientePaso(respuesta.data.id);
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        if (err.status === 409 && err.error?.data?.id) {
          // Ya existe una postulación de este CI para esta convocatoria: en
          // vez de dejarlo en un callejón sin salida, se ofrece continuarla.
          this.postulacionExistenteId.set(err.error.data.id);
        }
        this.error.set(err.error?.error?.message ?? 'No se pudo enviar la postulación. Intenta nuevamente.');
      },
    });
  }

  continuarPostulacionExistente(): void {
    const id = this.postulacionExistenteId();
    if (id) {
      this.irAlSiguientePaso(id);
    }
  }

  private irAlSiguientePaso(postulacionId: number): void {
    this.router.navigate(['/convocatorias/postulacion'], {
      queryParams: { id: postulacionId, codigo: this.codigo },
    });
  }

  volver(): void {
    this.router.navigate(['/convocatorias/detalle'], { queryParams: { codigo: this.codigo } });
  }
}
