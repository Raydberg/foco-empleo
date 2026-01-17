import { createClient } from "@supabase/supabase-js";

// Cargar variables de entorno
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || "jsearch.p.rapidapi.com";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Error: Faltan variables de entorno de Supabase");
  console.log("Asegúrate de tener PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY configuradas");
  process.exit(1);
}

if (!RAPIDAPI_KEY) {
  console.error("❌ Error: Falta RAPIDAPI_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Configuración de búsquedas
const SEARCHES = [
  { query: "desarrollador OR programador OR ingeniero software", country: "co", pages: 1, name: "Colombia - IT" },
  { query: "atención cliente OR servicio cliente OR call center", country: "co", pages: 1, name: "Colombia - Atención" },
  { query: "desarrollador OR programador", country: "mx", pages: 1, name: "México - IT" },
  { query: "desarrollador OR programador", country: "ar", pages: 1, name: "Argentina - IT" },
  { query: "desarrollador OR programador", country: "es", pages: 1, name: "España - IT" },
  { query: "desarrollador OR atención cliente", country: "cl", pages: 1, name: "Chile - IT/Servicios" },
];

// Mapa de países
const COUNTRY_MAP = {
  'españa': 'ES', 'spain': 'ES', 'madrid': 'ES', 'barcelona': 'ES', 'valencia': 'ES', 
  'argentina': 'AR', 'buenos aires': 'AR', 'córdoba': 'AR',
  'colombia': 'CO', 'bogota': 'CO', 'bogotá': 'CO', 'medellin': 'CO', 'medellín': 'CO', 'cali': 'CO',
  'costa rica': 'CR', 'san jose': 'CR',
  'dominicana': 'DO', 'santo domingo': 'DO',
  'ecuador': 'EC', 'quito': 'EC', 'guayaquil': 'EC',
  'guatemala': 'GT',
  'honduras': 'HN', 'tegucigalpa': 'HN',
  'mexico': 'MX', 'méxico': 'MX', 'ciudad de mexico': 'MX', 'guadalajara': 'MX', 'monterrey': 'MX',
  'panama': 'PA', 'panamá': 'PA',
  'paraguay': 'PY', 'asuncion': 'PY',
  'peru': 'PE', 'perú': 'PE', 'lima': 'PE',
  'el salvador': 'SV', 'san salvador': 'SV',
  'uruguay': 'UY', 'montevideo': 'UY',
  'venezuela': 'VE', 'caracas': 'VE',
  'chile': 'CL', 'santiago': 'CL',
  'remote': 'REMOTE', 'remoto': 'REMOTE',
};

function detectCountry(location) {
  const locationLower = location.toLowerCase();
  for (const [keyword, code] of Object.entries(COUNTRY_MAP)) {
    if (locationLower.includes(keyword)) return code;
  }
  return 'GLOBAL';
}

function detectSector(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  
  const itKeywords = ['developer', 'desarrollador', 'programador', 'software', 'engineer', 'php', 'python', 'javascript', 'react', 'frontend', 'backend', 'devops'];
  const csKeywords = ['customer', 'cliente', 'atención', 'service', 'teleoperador', 'call center', 'soporte'];
  const adminKeywords = ['admin', 'rrhh', 'recursos humanos', 'administrativo', 'asistente'];
  
  let itScore = itKeywords.filter(k => text.includes(k)).length;
  let csScore = csKeywords.filter(k => text.includes(k)).length;
  let adminScore = adminKeywords.filter(k => text.includes(k)).length;
  
  if (itScore > csScore && itScore > adminScore) return 'IT';
  if (csScore > itScore && csScore > adminScore) return 'CustomerService';
  if (adminScore > 0) return 'Administration';
  return 'Other';
}

async function fetchJobsFromAPI(search) {
  const allJobs = [];
  
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
      allJobs.push(...(data.data || []));
      console.log(`  ✅ Página ${page}: ${data.data?.length || 0} empleos`);
      
      if (page < search.pages) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`  ❌ Error:`, error);
    }
  }
  
  return allJobs;
}

function formatSalary(job) {
  if (job.job_salary) return job.job_salary;
  if (job.job_min_salary || job.job_max_salary) {
    const currency = job.job_salary_currency || 'USD';
    if (job.job_min_salary && job.job_max_salary) {
      return `${currency} ${job.job_min_salary.toLocaleString()} - ${job.job_max_salary.toLocaleString()}`;
    }
  }
  return null;
}

async function syncJobs() {
  console.log("=== INICIO DE SINCRONIZACIÓN ===");
  console.log(`📅 Fecha: ${new Date().toISOString()}`);
  
  // 1. Eliminar empleos antiguos (>24h)
  const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: deletedCount } = await supabase
    .from('jobs')
    .delete()
    .lt('synced_at', cutoffDate)
    .select('*', { count: 'exact', head: true });
  
  console.log(`🗑️ Eliminados ${deletedCount || 0} empleos antiguos`);
  
  // 2. Obtener empleos de la API
  const allJobs = [];
  let apiCalls = 0;
  
  for (const search of SEARCHES) {
    console.log(`\n🔍 ${search.name}`);
    const jobs = await fetchJobsFromAPI(search);
    allJobs.push(...jobs);
    apiCalls += search.pages;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n📊 Total obtenidos: ${allJobs.length}`);
  
  // 3. Guardar empleos
  let saved = 0;
  
  for (const job of allJobs) {
    if (!job.job_id || !job.job_title) continue;
    
    const location = job.job_city || job.job_state || job.job_country || '';
    
    const jobData = {
      job_id: job.job_id,
      title: job.job_title.substring(0, 500),
      company: job.employer_name?.substring(0, 255) || null,
      location: location.substring(0, 255),
      country: detectCountry(location),
      description: job.job_description || null,
      job_type: detectSector(job.job_title, job.job_description || ''),
      employment_type: job.job_employment_type || null,
      source: job.job_publisher?.substring(0, 100) || null,
      apply_link: job.job_apply_link || null,
      salary: formatSalary(job)?.substring(0, 100) || null,
      posted_date: job.job_posted_at_datetime_utc || null,
      synced_at: new Date().toISOString(),
      raw_data: JSON.stringify(job),
    };
    
    const { error } = await supabase.from('jobs').upsert(jobData, { onConflict: 'job_id' });
    if (!error) saved++;
  }
  
  console.log(`\n💾 Guardados: ${saved}`);
  
  // 4. Registrar sync
  await supabase.from('sync_log').insert({
    sync_date: new Date().toISOString(),
    jobs_fetched: allJobs.length,
    jobs_saved: saved,
    api_calls: apiCalls,
    status: 'success',
  });
  
  console.log("\n=== FIN DE SINCRONIZACIÓN ===");
}

// Ejecutar
syncJobs()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Error fatal:", err);
    process.exit(1);
  });
