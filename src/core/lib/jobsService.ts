import { supabase } from "./supabase";

/**
 * Interfaz para los datos de empleo formateados
 */
export interface Job {
  job_id: string;
  job_title: string;
  employer_name: string | null;
  employer_logo: string | null;
  job_city: string | null;
  job_state: string | null;
  job_country: string | null;
  job_description: string | null;
  job_employment_type: string | null;
  job_publisher: string | null;
  job_apply_link: string | null;
  job_salary: string | null;
  job_posted_at: string | null;
  job_is_remote: boolean;
  job_type_custom: string | null;
}

/**
 * Interfaz para los datos de la base de datos
 */
interface DbJob {
  id: number;
  job_id: string;
  title: string;
  company: string | null;
  location: string | null;
  country: string | null;
  description: string | null;
  job_type: string | null;
  employment_type: string | null;
  source: string | null;
  apply_link: string | null;
  salary: string | null;
  posted_date: string | null;
  synced_at: string;
  raw_data: string | null;
}

/**
 * Parsea los datos raw de JSearch si están disponibles
 */
function parseRawData(rawData: string | null): Record<string, any> {
  if (!rawData) return {};
  
  try {
    return JSON.parse(rawData);
  } catch {
    return {};
  }
}

/**
 * Formatea la fecha de publicación para mostrar
 */
function formatPostedDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Hoy";
    if (diffDays === 1) return "Ayer";
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
    
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return null;
  }
}

/**
 * Mapea un registro de la BD al formato de Job
 */
function mapDbJobToJob(dbJob: DbJob): Job {
  const raw = parseRawData(dbJob.raw_data);
  
  return {
    job_id: dbJob.job_id,
    job_title: dbJob.title,
    employer_name: dbJob.company,
    employer_logo: raw.employer_logo || null,
    job_city: raw.job_city || dbJob.location,
    job_state: raw.job_state || null,
    job_country: dbJob.country,
    job_description: dbJob.description,
    job_employment_type: dbJob.employment_type,
    job_publisher: dbJob.source,
    job_apply_link: dbJob.apply_link,
    job_salary: dbJob.salary,
    job_posted_at: formatPostedDate(dbJob.posted_date),
    job_is_remote: raw.job_is_remote || false,
    job_type_custom: dbJob.job_type,
  };
}

/**
 * Obtiene todos los empleos para la página de listado
 */
export async function getAllJobs(limit: number = 500): Promise<Job[]> {
  console.log("[jobsService] Obteniendo todos los empleos...");
  
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('posted_date', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error("[jobsService] Error al obtener empleos:", error.message);
    return [];
  }
  
  console.log(`[jobsService] Empleos obtenidos: ${data?.length || 0}`);
  return (data || []).map((job: DbJob) => mapDbJobToJob(job));
}

/**
 * Obtiene todos los IDs de empleos para getStaticPaths
 */
export async function getAllJobIds(): Promise<string[]> {
  console.log("[jobsService] Obteniendo IDs para getStaticPaths...");
  
  const { data, error } = await supabase
    .from('jobs')
    .select('job_id')
    .order('posted_date', { ascending: false })
    .limit(3000);
  
  if (error) {
    console.error("[jobsService] Error al obtener IDs:", error.message);
    return [];
  }
  
  console.log(`[jobsService] IDs obtenidos: ${data?.length || 0}`);
  return (data || []).map((j: { job_id: string }) => j.job_id);
}

/**
 * Obtiene un empleo por su ID
 */
export async function getJobById(jobId: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('job_id', jobId)
    .single();
  
  if (error || !data) {
    console.error("Error al obtener empleo:", error?.message);
    return null;
  }
  
  return mapDbJobToJob(data as DbJob);
}

/**
 * Obtiene empleos relacionados basándose en sector, empresa y país
 */
export async function getRelatedJobs(job: Job, limit: number = 6): Promise<Job[]> {
  // Extraer palabras clave del título
  const titleWords = job.job_title.toLowerCase().split(/\s+/);
  const stopwords = [
    'para', 'con', 'por', 'una', 'un', 'el', 'la', 'los', 'las', 
    'de', 'del', 'en', 'y', 'o', 'a', 'the', 'and', 'or', 'for', 'with',
    'junior', 'senior', 'jr', 'sr', 'mid', 'level'
  ];
  
  const keywords = titleWords
    .filter(word => word.length > 3 && !stopwords.includes(word))
    .slice(0, 3);
  
  // Construir filtro OR para Supabase
  let orFilters: string[] = [];
  
  if (job.job_type_custom) {
    orFilters.push(`job_type.eq.${job.job_type_custom}`);
  }
  if (job.employer_name) {
    orFilters.push(`company.eq.${job.employer_name}`);
  }
  if (job.job_country) {
    orFilters.push(`country.eq.${job.job_country}`);
  }
  
  // Si no hay filtros, buscar por país al menos
  if (orFilters.length === 0) {
    orFilters.push(`country.eq.GLOBAL`);
  }
  
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .neq('job_id', job.job_id)
    .or(orFilters.join(','))
    .order('posted_date', { ascending: false })
    .limit(limit * 3); // Obtener más para poder filtrar y ordenar por relevancia
  
  if (error || !data) {
    console.error("Error al obtener empleos relacionados:", error?.message);
    return [];
  }
  
  // Calcular score de relevancia para cada empleo
  const scoredJobs = data.map((dbJob: DbJob) => {
    const mappedJob = mapDbJobToJob(dbJob);
    let score = 0;
    
    // Mismo sector: 40 puntos
    if (dbJob.job_type === job.job_type_custom && job.job_type_custom) {
      score += 40;
    }
    
    // Misma empresa: 30 puntos
    if (dbJob.company === job.employer_name && job.employer_name) {
      score += 30;
    }
    
    // Mismo país: 10 puntos
    if (dbJob.country === job.job_country) {
      score += 10;
    }
    
    // Palabras clave en título: 7 puntos cada una
    const jobTitleLower = dbJob.title.toLowerCase();
    keywords.forEach(keyword => {
      if (jobTitleLower.includes(keyword)) {
        score += 7;
      }
    });
    
    return { job: mappedJob, score };
  });
  
  // Ordenar por score y retornar los mejores
  return scoredJobs
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.job);
}

/**
 * Busca empleos por texto (para búsqueda en cliente si se necesita)
 */
export async function searchJobs(query: string, limit: number = 100): Promise<Job[]> {
  const searchTerm = `%${query}%`;
  
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .or(`title.ilike.${searchTerm},description.ilike.${searchTerm},company.ilike.${searchTerm}`)
    .order('posted_date', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error("Error en búsqueda de empleos:", error.message);
    return [];
  }
  
  return (data || []).map((job: DbJob) => mapDbJobToJob(job));
}

/**
 * Obtiene empleos filtrados por país
 */
export async function getJobsByCountry(country: string, limit: number = 100): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('country', country.toUpperCase())
    .order('posted_date', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error("Error al obtener empleos por país:", error.message);
    return [];
  }
  
  return (data || []).map((job: DbJob) => mapDbJobToJob(job));
}

/**
 * Obtiene empleos filtrados por sector/tipo
 */
export async function getJobsByType(jobType: string, limit: number = 100): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('job_type', jobType)
    .order('posted_date', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error("Error al obtener empleos por tipo:", error.message);
    return [];
  }
  
  return (data || []).map((job: DbJob) => mapDbJobToJob(job));
}

/**
 * Obtiene el conteo total de empleos
 */
export async function getJobsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error("Error al obtener conteo de empleos:", error.message);
    return 0;
  }
  
  return count || 0;
}
