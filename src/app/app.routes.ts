import { Routes } from '@angular/router';
import { ConvocatoriasListComponent } from './convocatorias/convocatorias-list.component';
import { ConvocatoriaDetalleComponent } from './convocatorias/convocatoria-detalle.component';
import { PostularComponent } from './postulaciones/postular.component';
import { PostulacionWizardComponent } from './postulaciones/postulacion-wizard.component';
import { MisPostulacionesComponent } from './postulaciones/mis-postulaciones.component';
import { NotificacionesComponent } from './postulaciones/notificaciones.component';
import { PostulacionLayoutComponent } from './postulaciones/postulacion-layout.component';
import { RegistroComponent } from './registro/registro.component';
import { authGuard } from './core/auth.guard';
import { registroGuard } from './core/registro.guard';

export const routes: Routes = [
  // pathMatch: 'full' es imprescindible acá: sin él, path: '' (prefijo por
  // defecto) matchea CUALQUIER URL y se traga también las rutas del layout
  // de abajo — se detectó porque el build las prerenderaba como redirect a "/".
  { path: '', component: ConvocatoriasListComponent, pathMatch: 'full' },
  { path: 'convocatorias/detalle', component: ConvocatoriaDetalleComponent },
  // Registro del usuario de Ciudadanía Digital (primer ingreso) y edición de
  // sus datos. Requieren sesión.
  { path: 'registro', component: RegistroComponent, canActivate: [authGuard] },
  { path: 'mi-perfil', component: RegistroComponent, canActivate: [authGuard] },
  // Menú Lateral (pág. 43, ítem 20b): agrupa las pantallas del flujo de
  // postulación bajo un layout compartido con sidebar. El listado público
  // (arriba) queda fuera: ya tiene su propio encabezado institucional.
  {
    path: '',
    component: PostulacionLayoutComponent,
    children: [
      // Postular exige sesión de Ciudadanía Digital y registro completo: el
      // paso 1 se precarga con el perfil del usuario.
      { path: 'convocatorias/postular', component: PostularComponent, canActivate: [authGuard, registroGuard] },
      { path: 'convocatorias/postulacion', component: PostulacionWizardComponent, canActivate: [authGuard, registroGuard] },
      { path: 'postulaciones/mis-postulaciones', component: MisPostulacionesComponent, canActivate: [authGuard] },
      { path: 'postulaciones/notificaciones', component: NotificacionesComponent, canActivate: [authGuard] },
    ],
  },
];
