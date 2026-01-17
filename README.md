# Astro Starter Kit: Basics

```sql
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  job_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  company VARCHAR(255),
  location VARCHAR(255),
  country VARCHAR(10),
  description TEXT,
  job_type VARCHAR(50),
  employment_type VARCHAR(50),

  source VARCHAR(100),
  apply_link TEXT,

  salary VARCHAR(100),
  posted_date TIMESTAMP WITHOUT TIME ZONE,

  synced_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  raw_data TEXT,

  CONSTRAINT idx_job_id UNIQUE (job_id)
);


CREATE INDEX IF NOT EXISTS idx_country     ON jobs (country);
CREATE INDEX IF NOT EXISTS idx_source      ON jobs (source);
CREATE INDEX IF NOT EXISTS idx_job_type    ON jobs (job_type);
CREATE INDEX IF NOT EXISTS idx_synced_at   ON jobs (synced_at);
CREATE INDEX IF NOT EXISTS idx_posted_date ON jobs (posted_date);


CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sync_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  jobs_fetched INTEGER DEFAULT 0,
  jobs_saved INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'success',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_date ON sync_log (sync_date);

```

# Comandos
```bash
bun run sync - Sincroniza empleos desde JSearch a Supabase
bun run build - Solo build de Astro
bun run build:sync - Sincroniza + build (para producción)
```