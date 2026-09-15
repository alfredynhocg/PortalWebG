import { Routes } from '@angular/router';
import { ConvocatoriasListComponent } from './convocatorias/convocatorias-list.component';
import { ConvocatoriaDetalleComponent } from './convocatorias/convocatoria-detalle.component';
import { PostularComponent } from './postulaciones/postular.component';
import { PostulacionWizardComponent } from './postulaciones/postulacion-wizard.component';

export const routes: Routes = [
  { path: '', component: ConvocatoriasListComponent },
  { path: 'convocatorias/detalle', component: ConvocatoriaDetalleComponent },
  { path: 'convocatorias/postular', component: PostularComponent },
  { path: 'convocatorias/postulacion', component: PostulacionWizardComponent },
];
