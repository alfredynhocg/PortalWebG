import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

// Menú Lateral Izquierdo (pág. 43 del requerimiento) para las pantallas del
// flujo de postulación (postular, wizard, mis postulaciones). El listado
// público de convocatorias ya tiene su propio encabezado institucional (con
// el botón "Ingresar con Ciudadanía Digital") acorde a la pág. 21 — este menú
// es el de DESPUÉS de entrar al flujo, no reemplaza a ese.
//
// "Inicio" y "Nuevo registro" apuntan al listado de convocatorias (`/`): no
// existe todavía una pantalla de inicio propia del postulante ni un punto de
// entrada de "nuevo registro" sin elegir antes una convocatoria — son
// provisionales hasta que eso exista. "Notificaciones" (ítem 20c) no tiene
// backend construido: queda deshabilitado, no como un enlace roto.
@Component({
  selector: 'app-postulacion-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './postulacion-layout.component.html',
  styleUrl: './postulacion-layout.component.css',
})
export class PostulacionLayoutComponent {}
