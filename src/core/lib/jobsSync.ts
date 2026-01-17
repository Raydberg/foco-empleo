import { supabaseAdmin } from "./supabase";

// Configuración de la API
const RAPIDAPI_KEY = import.meta.env.RAPIDAPI_KEY || process.env.RAPIDAPI_KEY || "";
const RAPIDAPI_HOST = import.meta.env.RAPIDAPI_HOST || process.env.RAPIDAPI_HOST || "jsearch.p.rapidapi.com";

// Configuración de búsquedas por país e industria
const SEARCHES = [
  { query: "desarrollador OR programador OR ingeniero software", country: "co", pages: 1, name: "Colombia - IT" },
  { query: "atención cliente OR servicio cliente OR call center", country: "co", pages: 1, name: "Colombia - Atención" },
  { query: "desarrollador OR programador", country: "mx", pages: 1, name: "México - IT" },
  { query: "desarrollador OR programador", country: "ar", pages: 1, name: "Argentina - IT" },
  { query: "desarrollador OR programador", country: "es", pages: 1, name: "España - IT" },
  { query: "desarrollador OR atención cliente", country: "cl", pages: 1, name: "Chile - IT/Servicios" },
];

// Mapa de detección de países por ubicación
const COUNTRY_MAP: Record<string, string> = {
  // España
  'españa': 'ES', 'spain': 'ES', 'madrid': 'ES', 'barcelona': 'ES', 'valencia': 'ES', 
  'sevilla': 'ES', 'bilbao': 'ES', 'málaga': 'ES', 'zaragoza': 'ES',
  // Argentina
  'argentina': 'AR', 'buenos aires': 'AR', 'córdoba': 'AR', 'rosario': 'AR', 'mendoza': 'AR',
  // Colombia
  'colombia': 'CO', 'bogota': 'CO', 'bogotá': 'CO', 'medellin': 'CO', 'medellín': 'CO', 
  'cali': 'CO', 'barranquilla': 'CO', 'cartagena': 'CO',
  // Costa Rica
  'costa rica': 'CR', 'san jose': 'CR', 'san josé': 'CR',
  // República Dominicana
  'dominicana': 'DO', 'santo domingo': 'DO', 'república dominicana': 'DO',
  // Ecuador
  'ecuador': 'EC', 'quito': 'EC', 'guayaquil': 'EC', 'cuenca': 'EC',
  // Guatemala
  'guatemala': 'GT', 'ciudad de guatemala': 'GT',
  // Honduras
  'honduras': 'HN', 'tegucigalpa': 'HN', 'san pedro sula': 'HN',
  // México
  'mexico': 'MX', 'méxico': 'MX', 'ciudad de mexico': 'MX', 'cdmx': 'MX',
  'guadalajara': 'MX', 'monterrey': 'MX', 'puebla': 'MX', 'tijuana': 'MX',
  // Panamá
  'panama': 'PA', 'panamá': 'PA', 'ciudad de panamá': 'PA',
  // Paraguay
  'paraguay': 'PY', 'asuncion': 'PY', 'asunción': 'PY',
  // Perú
  'peru': 'PE', 'perú': 'PE', 'lima': 'PE', 'arequipa': 'PE', 'trujillo': 'PE',
  // El Salvador
  'el salvador': 'SV', 'salvador': 'SV', 'san salvador': 'SV',
  // Uruguay
  'uruguay': 'UY', 'montevideo': 'UY',
  // Venezuela
  'venezuela': 'VE', 'caracas': 'VE', 'maracaibo': 'VE', 'valencia': 'VE',
  // Chile
  'chile': 'CL', 'santiago': 'CL', 'valparaíso': 'CL', 'concepción': 'CL',
  // Remoto
  'remote': 'REMOTE', 'remoto': 'REMOTE',
};

/**
 * Detecta el país basándose en la ubicación
 */
function detectCountry(location: string): string {
  const locationLower = location.toLowerCase();
  
  for (const [keyword, code] of Object.entries(COUNTRY_MAP)) {
    if (locationLower.includes(keyword)) {
      return code;
    }
  }
  
  return 'GLOBAL';
}

/**
 * Detecta el sector/tipo de trabajo basándose en título y descripción
 */
function detectSector(title: string, description: string): string {
  const text = (title + ' ' + description).toLowerCase();
  
  const itKeywords = [
    'developer', 'desarrollador', 'programador', 'software', 'engineer', 'ingeniero',
    'php', 'python', 'javascript', 'react', 'angular', 'vue', 'node',
    'frontend', 'backend', 'fullstack', 'full-stack', 'devops', 'tech',
    'data', 'machine learning', 'ai', 'cloud', 'aws', 'azure', 'java', 'c#', '.net',
    'mobile', 'ios', 'android', 'flutter', 'react native', 'qa', 'testing'
  ];
  
  const csKeywords = [
    'customer', 'cliente', 'atención', 'atencion', 'service', 'servicio',
    'teleoperador', 'call center', 'soporte', 'support', 'helpdesk',
    'chat', 'ventas', 'sales', 'comercial'
  ];
  
  const adminKeywords = [
    'admin', 'rrhh', 'recursos humanos', 'hr', 'human resources',
    'administrador', 'administrativo', 'asistente', 'assistant',
    'contador', 'accounting', 'finanzas', 'finance', 'legal'
  ];
  
  let itScore = itKeywords.filter(k => text.includes(k)).length;
  let csScore = csKeywords.filter(k => text.includes(k)).length;
  let adminScore = adminKeywords.filter(k => text.includes(k)).length;
  
  if (itScore > csScore && itScore > adminScore) return 'IT';
  if (csScore > itScore && csScore > adminScore) return 'CustomerService';
  if (adminScore > 0) return 'Administration';
  
  return 'Other';
}

// Interfaz para los datos de JSearch API
interface JSearchJob {
  job_id: string;
  job_title: string;
  employer_name: string;
  employer_logo?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_description?: string;
  job_publisher?: string;
  job_apply_link?: string;
  job_salary?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
  job_salary_period?: string;
  job_employment_type?: string;
  job_posted_at_datetime_utc?: string;
  job_is_remote?: boolean;
}

/**
 * Obtiene empleos de la API de JSearch
 */
async function fetchJobsFromAPI(search: typeof SEARCHES[0]): Promise<JSearchJob[]> {
  const allJobs: JSearchJob[] = [];
  
  for (let page = 1; page <= search.pages; page++) {
    const params = new URLSearchParams({
      query: search.query,
      page: page.toString(),
      num_pages: '1',
      date_posted: 'all',
      country: search.country,
    });
    
    const url = `https://${RAPIDAPI_HOST}/search?${params}`;
    
    try {
      console.log(`  📄 Página ${page}/${search.pages}...`);
      
      const response = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      });
      
      if (!response.ok) {
        console.error(`  ❌ Error HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const jobs = data.data || [];
      allJobs.push(...jobs);
      
      console.log(`  ✅ ${jobs.length} empleos obtenidos`);
      
      // Esperar entre páginas para no exceder límites
      if (page < search.pages) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`  ❌ Error:`, error);
    }
  }
  
  return allJobs;
}

/**
 * Formatea el salario para mostrar
 */
function formatSalary(job: JSearchJob): string | null {
  if (job.job_salary) return job.job_salary;
  
  if (job.job_min_salary || job.job_max_salary) {
    const currency = job.job_salary_currency || 'USD';
    const period = job.job_salary_period || 'year';
    
    if (job.job_min_salary && job.job_max_salary) {
      return `${currency} ${job.job_min_salary.toLocaleString()} - ${job.job_max_salary.toLocaleString()} / ${period}`;
    } else if (job.job_min_salary) {
      return `${currency} ${job.job_min_salary.toLocaleString()}+ / ${period}`;
    } else if (job.job_max_salary) {
      return `Hasta ${currency} ${job.job_max_salary.toLocaleString()} / ${period}`;
    }
  }
  
  return null;
}

/**
 * Sincroniza empleos desde JSearch API a Supabase
 */
export async function syncJobs(): Promise<{ fetched: number; saved: number; deleted: number }> {
  console.log("=== INICIO DE SINCRONIZACIÓN ===");
  console.log(`📅 Fecha: ${new Date().toISOString()}`);
  
  // 1. Eliminar empleos antiguos (>24h)
  const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { error: deleteError, count: deletedCount } = await supabaseAdmin
    .from('jobs')
    .delete()
    .lt('synced_at', cutoffDate)
    .select('*', { count: 'exact', head: true });
  
  if (deleteError) {
    console.error("⚠️ Error al limpiar empleos antiguos:", deleteError.message);
  } else {
    console.log(`🗑️ Eliminados ${deletedCount || 0} empleos antiguos (>24h)`);
  }
  
  // 2. Obtener empleos de la API
  const allJobs: JSearchJob[] = [];
  let apiCalls = 0;
  
  for (const search of SEARCHES) {
    console.log(`\n🔍 Búsqueda: ${search.name}`);
    
    const jobs = await fetchJobsFromAPI(search);
    allJobs.push(...jobs);
    apiCalls += search.pages;
    
    // Esperar 1 segundo entre búsquedas para no exceder límites de la API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n📊 Total de empleos obtenidos: ${allJobs.length}`);
  console.log(`📊 Llamadas a la API: ${apiCalls}`);
  
  // 3. Procesar y guardar empleos
  let jobsSaved = 0;
  let jobsSkipped = 0;
  
  for (const job of allJobs) {
    // Validar datos mínimos
    if (!job.job_id || !job.job_title) {
      jobsSkipped++;
      continue;
    }
    
    // Detectar ubicación y país
    const location = job.job_city || job.job_state || job.job_country || '';
    const country = detectCountry(location);
    
    // Detectar sector
    const jobType = detectSector(job.job_title, job.job_description || '');
    
    // Preparar datos para insertar
    const jobData = {
      job_id: job.job_id,
      title: job.job_title.substring(0, 500),
      company: job.employer_name?.substring(0, 255) || null,
      location: location.substring(0, 255),
      country,
      description: job.job_description || null,
      job_type: jobType,
      employment_type: job.job_employment_type || null,
      source: job.job_publisher?.substring(0, 100) || null,
      apply_link: job.job_apply_link || null,
      salary: formatSalary(job)?.substring(0, 100) || null,
      posted_date: job.job_posted_at_datetime_utc || null,
      synced_at: new Date().toISOString(),
      raw_data: JSON.stringify(job),
    };
    
    // Insertar o actualizar (upsert)
    const { error } = await supabaseAdmin
      .from('jobs')
      .upsert(jobData, { onConflict: 'job_id' });
    
    if (!error) {
      jobsSaved++;
    } else {
      console.error(`⚠️ Error al guardar empleo ${job.job_id}:`, error.message);
    }
  }
  
  console.log(`\n💾 Empleos guardados/actualizados: ${jobsSaved}`);
  console.log(`⏭️ Empleos omitidos (datos inválidos): ${jobsSkipped}`);
  
  // 4. Registrar en sync_log
  const { error: logError } = await supabaseAdmin.from('sync_log').insert({
    sync_date: new Date().toISOString(),
    jobs_fetched: allJobs.length,
    jobs_saved: jobsSaved,
    api_calls: apiCalls,
    status: 'success',
  });
  
  if (logError) {
    console.error("⚠️ Error al registrar sync_log:", logError.message);
  }
  
  console.log("\n=== FIN DE SINCRONIZACIÓN ===\n");
  
  return { 
    fetched: allJobs.length, 
    saved: jobsSaved,
    deleted: deletedCount || 0
  };
}

/**
 * Obtiene el estado de la última sincronización
 */
export async function getLastSyncStatus() {
  const { data, error } = await supabaseAdmin
    .from('sync_log')
    .select('*')
    .order('sync_date', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    return null;
  }
  
  return data;
}
