import { Routes } from '@angular/router';
import { ConvocatoriasListComponent } from './convocatorias/convocatorias-list.component';
import { ConvocatoriaDetalleComponent } from './convocatorias/convocatoria-detalle.component';
import { PostularComponent } from './postulaciones/postular.component';
import { PostulacionWizardComponent } from './postulaciones/postulacion-wizard.component';
import { MisPostulacionesComponent } from './postulaciones/mis-postulaciones.component';
import { PostulacionLayoutComponent } from './postulaciones/postulacion-layout.component';

export const routes: Routes = [
  // pathMatch: 'full' es imprescindible acá: sin él, path: '' (prefijo por
  // defecto) matchea CUALQUIER URL y se traga también las rutas del layout
  // de abajo — se detectó porque el build las prerenderaba como redirect a "/".
  { path: '', component: ConvocatoriasListComponent, pathMatch: 'full' },
  { path: 'convocatorias/detalle', component: ConvocatoriaDetalleComponent },
  // Menú Lateral (pág. 43, ítem 20b): agrupa las pantallas del flujo de
  // postulación bajo un layout compartido con sidebar. El listado público
  // (arriba) queda fuera: ya tiene su propio encabezado institucional.
  {
    path: '',
    component: PostulacionLayoutComponent,
    children: [
      { path: 'convocatorias/postular', component: PostularComponent },
      { path: 'convocatorias/postulacion', component: PostulacionWizardComponent },
      { path: 'postulaciones/mis-postulaciones', component: MisPostulacionesComponent },
    ],
  },
];
