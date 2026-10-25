const {Client}=require('pg');
const c=new Client({connectionString:process.env.DATABASE_URL});
c.connect().then(async()=>{
  try{
    await c.query('CREATE TABLE IF NOT EXISTS crypto_wallets (id TEXT PRIMARY KEY, name VARCHAR(40) NOT NULL, network VARCHAR(60) NOT NULL, address VARCHAR(200) NOT NULL, enabled BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL)');
    await c.query('CREATE INDEX IF NOT EXISTS crypto_wallets_enabled_name_idx ON crypto_wallets (enabled, name)');
    const r=await c.query('SELECT count(*) FROM crypto_wallets');
    console.log(r.rows[0]);
  }catch(e){console.error(e.message);}
  await c.end();
});
