import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, shareReplay, switchMap } from 'rxjs/operators';
import { DEMO_CONFIG } from '../demo-config';
import {
  ConvocatoriaDetalleResponse,
  ConvocatoriasFiltros,
  ConvocatoriasResponse,
  ConvocatoriasStreamResultado,
  FormularioConvocatoriaResponse,
  FormularioPublicacionResponse,
  MetricasResponse,
} from './convocatoria.model';

@Injectable({ providedIn: 'root' })
export class ConvocatoriasService {
  private readonly filtros$ = new Subject<ConvocatoriasFiltros>();

  private readonly stream$: Observable<ConvocatoriasStreamResultado> = this.filtros$.pipe(
    debounceTime(300),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    switchMap((filtros) =>
      this.listar(filtros).pipe(
        map((respuesta): ConvocatoriasStreamResultado => ({ ok: true, respuesta })),
        catchError((err: HttpErrorResponse) => of<ConvocatoriasStreamResultado>({ ok: false, status: err.status }))
      )
    ),
    shareReplay(1)
  );

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${DEMO_CONFIG.demoToken}`,
      Accept: 'application/json',
    });
  }

  listar(filtros: ConvocatoriasFiltros): Observable<ConvocatoriasResponse> {
    let params = new HttpParams();
    Object.entries(filtros).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    });

    return this.http.get<ConvocatoriasResponse>(`${DEMO_CONFIG.apiBaseUrl}/portal/convocatorias`, {
      headers: this.headers(),
      params,
    });
  }


  detalles(codigo: string): Observable<ConvocatoriaDetalleResponse> {
    return this.http.get<ConvocatoriaDetalleResponse>(`${DEMO_CONFIG.apiBaseUrl}/portal/convocatorias/${codigo}`, {
      headers: this.headers(),
    });
  }

  formularioPublicacion(): Observable<FormularioPublicacionResponse> {
    return this.http.get<FormularioPublicacionResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/formularios/convocatoria-publicada`,
      { headers: this.headers() }
    );
  }

  formularioConvocatoria(codigo: string): Observable<FormularioConvocatoriaResponse> {
    return this.http.get<FormularioConvocatoriaResponse>(
      `${DEMO_CONFIG.apiBaseUrl}/portal/convocatorias/${codigo}/formulario`,
      { headers: this.headers() }
    );
  }

  metricas(): Observable<MetricasResponse> {
    return this.http.get<MetricasResponse>(`${DEMO_CONFIG.apiBaseUrl}/portal/convocatorias/metricas`, {
      headers: this.headers(),
    });
  }

  actualizarFiltros(filtros: ConvocatoriasFiltros): void {
    this.filtros$.next(filtros);
  }

  stream(): Observable<ConvocatoriasStreamResultado> {
    return this.stream$;
  }
}
