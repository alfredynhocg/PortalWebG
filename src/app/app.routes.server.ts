import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Dependen de la sesión del usuario (cookie): no se pueden prerenderizar.
  { path: 'registro', renderMode: RenderMode.Client },
  { path: 'mi-perfil', renderMode: RenderMode.Client },
  { path: 'convocatorias/postular', renderMode: RenderMode.Client },
  { path: 'convocatorias/postulacion', renderMode: RenderMode.Client },
  { path: 'postulaciones/mis-postulaciones', renderMode: RenderMode.Client },
  { path: 'postulaciones/notificaciones', renderMode: RenderMode.Client },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
