// src/supabaseClient.js
import { createClient, FunctionRegion } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Les Edge Functions s'executen sempre a eu-west-1 (Irlanda), la mateixa regió
// que la base de dades. Cal passar-la a cada functions.invoke(); supabase-js
// l'envia com a capçalera x-region i paràmetre forceFunctionRegion.
export const REGIO_FUNCIONS = FunctionRegion.EuWest1;
