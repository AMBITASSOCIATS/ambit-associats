SET local check_function_bodies = off;

CREATE TABLE "public"."declaracions" (
  "id"           text                     NOT NULL DEFAULT (gen_random_uuid())::text,
  "user_id"      uuid                     NOT NULL,
  "client_nom"   text,
  "client_nrt"   text,
  "exercici"     integer                  DEFAULT 2025,
  "estat"        text                     DEFAULT 'esborrany'::text,
  "dades"        jsonb                    DEFAULT '{}'::jsonb,
  "creat_el"     timestamp with time zone DEFAULT now(),
  "modificat_el" timestamp with time zone DEFAULT now(),
  CONSTRAINT "declaracions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."declaracions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profiles" (
  "id"         uuid                     NOT NULL,
  "email"      text                     NOT NULL,
  "nom"        text,
  "rol"        text                     NOT NULL DEFAULT 'individual'::text,
  "empresa_id" uuid,
  "estat"      text                     NOT NULL DEFAULT 'pendent'::text,
  "creat_el"   timestamp with time zone DEFAULT now(),
  "eines"      text[]                   DEFAULT '{}'::text[],
  "capcalera"  jsonb,
  CONSTRAINT "profiles_estat_check" CHECK ((estat = ANY (ARRAY['pendent'::text, 'actiu'::text, 'bloquejat'::text]))),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "profiles_rol_check" CHECK ((rol = ANY (ARRAY['maestro'::text, 'empresa'::text, 'empleat'::text, 'individual'::text])))
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."solicituds" (
  "id"       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nom"      text                     NOT NULL,
  "email"    text                     NOT NULL,
  "estat"    text                     DEFAULT 'pendent'::text,
  "creat_el" timestamp with time zone DEFAULT now(),
  "eines"    text[]                   DEFAULT '{}'::text[],
  CONSTRAINT "solicituds_email_key" UNIQUE (email),
  CONSTRAINT "solicituds_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."solicituds"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_my_rol()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
  select rol from public.profiles where id = auth.uid() limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.impedeix_autoassignar_rol()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'UPDATE' and new.rol is distinct from old.rol then
      raise exception 'No es permet modificar el rol';
    end if;
    if tg_op = 'INSERT' and new.rol = 'maestro' then
      raise exception 'No es permet assignar el rol maestro';
    end if;
  end if;
  return new;
end;
$function$;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."declaracions"
  ADD CONSTRAINT "declaracions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.profiles(id);

CREATE TRIGGER impedeix_autoassignar_rol
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.impedeix_autoassignar_rol();

CREATE POLICY "Maestro veu totes les declaracions" ON "public"."declaracions"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.rol = 'maestro'::text)))));

CREATE POLICY "Usuari crea les seves declaracions" ON "public"."declaracions"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Usuari elimina les seves declaracions" ON "public"."declaracions"
  FOR DELETE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Usuari modifica les seves declaracions" ON "public"."declaracions"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Usuari veu les seves declaracions" ON "public"."declaracions"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Usuaris actualitzen les seves declaracions" ON "public"."declaracions"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Usuaris eliminen les seves declaracions" ON "public"."declaracions"
  FOR DELETE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Usuaris insereixen les seves declaracions" ON "public"."declaracions"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "perfil_propi" ON "public"."profiles"
  FOR ALL
  TO PUBLIC
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "Inserció pública" ON "public"."solicituds"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);

CREATE POLICY "Maestro actualitza sollicituds" ON "public"."solicituds"
  FOR UPDATE
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.rol = 'maestro'::text)))));

CREATE POLICY "Maestro elimina sollicituds" ON "public"."solicituds"
  FOR DELETE
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.rol = 'maestro'::text)))));

CREATE POLICY "Maestro veu totes les sollicituds" ON "public"."solicituds"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.rol = 'maestro'::text)))));

CREATE POLICY "Maestro veu totes les sol·licituds" ON "public"."solicituds"
  FOR ALL
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.rol = 'maestro'::text)))));

CREATE POLICY "Qualsevol pot inserir sollicituds" ON "public"."solicituds"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);

GRANT EXECUTE ON FUNCTION "public"."get_my_rol"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."get_my_rol"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_my_rol"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_my_rol"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."impedeix_autoassignar_rol"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."impedeix_autoassignar_rol"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."impedeix_autoassignar_rol"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."impedeix_autoassignar_rol"() TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."declaracions" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."declaracions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."declaracions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."declaracions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."profiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."solicituds" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."solicituds" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."solicituds" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."solicituds" TO "service_role";

