# 2026-09-04 — Nueva columna `events.kind`

Clasifica cada evento como `banner | mission | login_event | other`. La leerá
la futura página `/[game]/banners` (filtro `kind = 'banner'`); `/hoy` y
`/juegos` NO filtran por kind. La heurística que rellena la columna vive en
`src/lib/scraper/classify.ts`; el backfill de las filas existentes, en
`scripts/backfill-event-kinds.mjs`.

## Ejecución (30 segundos)

Supabase Dashboard → SQL Editor → pegar y Run. **Ejecutar ANTES** de
`node scripts/backfill-event-kinds.mjs --apply` y antes de desplegar el código
del runner que escribe `kind`.

```sql
create type public.event_kind as enum ('banner', 'mission', 'login_event', 'other');

alter table public.events
  add column kind public.event_kind;
```

## Notas

- **Sin `default` ni `not null` a propósito**: `NULL` = pendiente de
  clasificar, y es lo que hace idempotente el backfill (solo toca filas con
  `kind is null`).
- **RLS sin cambios**: las policies son de tabla/fila (`is_active = true`
  para lectura pública) y no mencionan columnas; la nueva viaja con ellas.
- El dashboard recarga el schema cache de PostgREST al aplicar DDL. Si se
  aplicara por otro camino y la columna no apareciera en la API:
  `notify pgrst, 'reload schema';`
- Opcional cuando el scraper lleve semanas clasificando todas las filas:
  `alter table public.events alter column kind set not null;`
- No se crea índice: la tabla tiene ~40 filas.

## Rollback

```sql
alter table public.events drop column if exists kind;
drop type if exists public.event_kind;
```

## Estado de los tipos TS

`src/lib/supabase/types.ts` lleva `event_kind` y `events.kind` añadidos A MANO
(override temporal marcado en su cabecera) porque la regeneración con
`supabase gen types` exige la DDL aplicada. Una vez aplicada y regenerados los
tipos, el override desaparece solo.
